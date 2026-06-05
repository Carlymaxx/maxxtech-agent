import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, settingsTable } from "@workspace/db";
import { SendAnthropicMessageBody, SendAnthropicMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as geminiAI, ai2 as geminiAI2 } from "@workspace/integrations-gemini-ai";
import OpenAI from "openai";

const router: IRouter = Router();

function getModelProvider(model: string): "anthropic" | "gemini" | "groq" {
  if (model.startsWith("gemini")) return "gemini";
  if (
    model.startsWith("llama") ||
    model.startsWith("mixtral") ||
    model.startsWith("meta-llama") ||
    model.startsWith("deepseek") ||
    model.startsWith("qwen")
  )
    return "groq";
  return "anthropic";
}

const IMAGE_GEN_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
];

export const ALL_MODELS = [
  { id: "claude-sonnet-4-6", provider: "Claude (Anthropic)" },
  { id: "claude-opus-4-7", provider: "Claude (Anthropic)" },
  { id: "claude-haiku-4-5", provider: "Claude (Anthropic)" },
  { id: "gemini-3.1-pro-preview", provider: "Gemini (Google)" },
  { id: "gemini-3-flash-preview", provider: "Gemini (Google)" },
  { id: "gemini-2.5-pro", provider: "Gemini (Google)" },
  { id: "gemini-2.5-flash", provider: "Gemini (Google)" },
  { id: "gemini-2.5-flash-image", provider: "Gemini Image Gen" },
  { id: "gemini-3.1-flash-image", provider: "Gemini Image Gen (3.1)" },
  { id: "meta-llama/llama-4-maverick", provider: "OpenRouter" },
  { id: "meta-llama/llama-4-scout", provider: "OpenRouter" },
  { id: "meta-llama/llama-3.3-70b-instruct", provider: "OpenRouter" },
  { id: "deepseek/deepseek-r1", provider: "OpenRouter" },
  { id: "qwen/qwen3-235b-a22b", provider: "OpenRouter" },
];

router.get("/agent/models", async (_req, res): Promise<void> => {
  res.json({ models: ALL_MODELS });
});

// Helper: try image generation with a given client, returns null on billing/quota error
async function tryGeminiImageGen(
  client: InstanceType<typeof import("@google/genai").GoogleGenAI>,
  model: string,
  prompt: string,
): Promise<{ imageUrl: string; caption: string } | { error: string } | null> {
  try {
    const result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });
    let imageUrl: string | null = null;
    let caption = "";
    for (const part of result.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData) {
        const b64 = part.inlineData.data ?? "";
        imageUrl = `data:${part.inlineData.mimeType ?? "image/png"};base64,${b64}`;
      }
      if (part.text) caption += part.text;
    }
    if (imageUrl) return { imageUrl, caption };
    return { error: caption || "No image returned." };
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    // Quota / billing errors → signal caller to try next key
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("paid") || msg.includes("billing")) {
      return null;
    }
    return { error: msg };
  }
}

router.post("/conversations/:id/stream", async (req, res): Promise<void> => {
  const params = SendAnthropicMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = SendAnthropicMessageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const convId = params.data.id;
  const incomingImages: { data: string; mimeType: string }[] = (req.body.images ?? []);

  const [settings] = await db.select().from(settingsTable).limit(1);
  const systemPrompt =
    settings?.systemPrompt ??
    "You are MAXX, a powerful AI assistant created by CarlymaxX. You are helpful, smart, and capable of writing code, analyzing images, answering any question, and solving complex problems. Never reveal what AI models or APIs power you — just say you are MAXX, built by CarlymaxX.";

  const requestedModel = body.data.model ?? settings?.model ?? "gemini-2.5-flash";
  const provider = getModelProvider(requestedModel);
  const isImageGen = IMAGE_GEN_MODELS.includes(requestedModel);

  const userContent = body.data.content;
  await db.insert(messagesTable).values({ conversationId: convId, role: "user", content: userContent });
  await db.update(conversationsTable)
    .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt);
  const chatMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let fullResponse = "";

  try {
    // ── Image generation (Gemini) ─────────────────────────────────────────
    if (isImageGen) {
      // Try key 1 first
      let imgResult = await tryGeminiImageGen(geminiAI, requestedModel, userContent);

      // Try key 2 if key 1 had quota/billing issue
      if (imgResult === null && geminiAI2) {
        imgResult = await tryGeminiImageGen(geminiAI2, requestedModel, userContent);
      }

      if (imgResult === null) {
        // Both keys exhausted — friendly message
        const msg = "⚠️ **Image generation requires billing enabled on Google AI Studio.**\n\nTo enable it:\n1. Go to [aistudio.google.com](https://aistudio.google.com)\n2. Click your project → Billing → Enable billing\n3. Image generation will work immediately after.\n\nIn the meantime, I can **describe** the image in detail or help with anything else.";
        res.write(`data: ${JSON.stringify({ content: msg })}\n\n`);
        fullResponse = msg;
      } else if ("imageUrl" in imgResult) {
        res.write(`data: ${JSON.stringify({ imageUrl: imgResult.imageUrl })}\n\n`);
        fullResponse = imgResult.caption || "Image generated.";
      } else {
        res.write(`data: ${JSON.stringify({ content: imgResult.error })}\n\n`);
        fullResponse = imgResult.error;
      }

    // ── Claude (with optional vision) ────────────────────────────────────
    } else if (provider === "anthropic") {
      const lastUserIndex = chatMessages.map((m) => m.role).lastIndexOf("user");
      const anthropicMessages = chatMessages.map((m, i) => {
        if (i === lastUserIndex && incomingImages.length > 0) {
          return {
            role: "user" as const,
            content: [
              ...incomingImages.map((img) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: img.data,
                },
              })),
              { type: "text" as const, text: m.content },
            ],
          };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      });

      const stream = anthropic.messages.stream({
        model: requestedModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
        }
      }

    // ── Gemini (with optional vision) ────────────────────────────────────
    } else if (provider === "gemini") {
      const allowedChatModels = [
        "gemini-3.1-pro-preview","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash",
        "gemini-3.1-flash-lite","gemini-3.1-flash-lite-preview","gemini-flash-latest",
      ];
      const safeModel = allowedChatModels.includes(requestedModel) ? requestedModel : "gemini-2.5-flash";

      const geminiContents = chatMessages.map((m, i) => {
        const isLastUser = m.role === "user" && i === chatMessages.map((x) => x.role).lastIndexOf("user");
        const parts: any[] = [];
        if (isLastUser && incomingImages.length > 0) {
          incomingImages.forEach((img) => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
          });
        }
        parts.push({ text: m.content });
        return {
          role: m.role === "assistant" ? ("model" as const) : ("user" as const),
          parts,
        };
      });

      const gemStream = await geminiAI.models.generateContentStream({
        model: safeModel,
        systemInstruction: systemPrompt,
        contents: geminiContents,
      });

      for await (const chunk of gemStream) {
        const text = chunk.text ?? "";
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

    // ── OpenRouter (Llama / DeepSeek / Qwen — with optional vision) ───────
    } else {
      const openrouter = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? "no-key",
      });

      const orMessages: any[] = [{ role: "system", content: systemPrompt }, ...chatMessages];

      if (incomingImages.length > 0) {
        const last = orMessages[orMessages.length - 1];
        if (last.role === "user") {
          last.content = [
            ...incomingImages.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mimeType};base64,${img.data}` },
            })),
            { type: "text", text: last.content },
          ];
        }
      }

      const stream = await openrouter.chat.completions.create({
        model: requestedModel, max_tokens: 8192, stream: true, messages: orMessages,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    }

    const [assistantMsg] = await db.insert(messagesTable)
      .values({ conversationId: convId, role: "assistant", content: fullResponse || "Image generated." })
      .returning();
    await db.update(conversationsTable)
      .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
      .where(eq(conversationsTable.id, convId));

    res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMsg.id })}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  }

  res.end();
});

export default router;
