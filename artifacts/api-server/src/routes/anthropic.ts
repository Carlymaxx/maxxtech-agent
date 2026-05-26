import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, settingsTable } from "@workspace/db";
import { SendAnthropicMessageBody, SendAnthropicMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as geminiAI } from "@workspace/integrations-gemini-ai";
import OpenAI from "openai";

const router: IRouter = Router();

// ── Model routing ─────────────────────────────────────────────────────────────

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

const IMAGE_GEN_MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];

export const ALL_MODELS = [
  { id: "claude-sonnet-4-6", provider: "Claude (Anthropic)" },
  { id: "claude-opus-4-7", provider: "Claude (Anthropic)" },
  { id: "claude-haiku-4-5", provider: "Claude (Anthropic)" },
  { id: "gemini-3.1-pro-preview", provider: "Gemini (Google)" },
  { id: "gemini-3-flash-preview", provider: "Gemini (Google)" },
  { id: "gemini-2.5-pro", provider: "Gemini (Google)" },
  { id: "gemini-2.5-flash", provider: "Gemini (Google)" },
  { id: "gemini-2.5-flash-image", provider: "Gemini Image Gen" },
  { id: "meta-llama/llama-4-maverick", provider: "OpenRouter" },
  { id: "meta-llama/llama-4-scout", provider: "OpenRouter" },
  { id: "meta-llama/llama-3.3-70b-instruct", provider: "OpenRouter" },
  { id: "deepseek/deepseek-r1", provider: "OpenRouter" },
  { id: "qwen/qwen3-235b-a22b", provider: "OpenRouter" },
];

// ── Models list endpoint ──────────────────────────────────────────────────────

router.get("/agent/models", async (_req, res): Promise<void> => {
  res.json({ models: ALL_MODELS });
});

// ── Streaming chat + image gen endpoint ──────────────────────────────────────

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
    "You are MaxxTech Agent, a powerful AI assistant built by CarlymaxX for tech and IT professionals. You can write and run code, search the web, analyse images, and help with complex technical problems.";

  const requestedModel = body.data.model ?? settings?.model ?? "claude-sonnet-4-6";
  const provider = getModelProvider(requestedModel);
  const isImageGen = IMAGE_GEN_MODELS.includes(requestedModel);

  // Persist user message
  const userContent = body.data.content;
  await db.insert(messagesTable).values({ conversationId: convId, role: "user", content: userContent });
  await db.update(conversationsTable)
    .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  // Build chat history
  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt);
  const chatMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // SSE setup
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let fullResponse = "";

  try {
    // ── Image generation (Gemini) ─────────────────────────────────────────
    if (isImageGen) {
      const imgResult = await geminiAI.models.generateContent({
        model: requestedModel,
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });

      let imageUrl: string | null = null;
      let captionText = "";

      for (const part of imgResult.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
          const b64 = part.inlineData.data ?? "";
          imageUrl = `data:${part.inlineData.mimeType ?? "image/png"};base64,${b64}`;
        }
        if (part.text) captionText += part.text;
      }

      if (imageUrl) {
        res.write(`data: ${JSON.stringify({ imageUrl })}\n\n`);
        fullResponse = captionText || "Image generated.";
      } else {
        fullResponse = captionText || "Sorry, image generation did not return an image.";
        res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
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
      const safeModel = ["gemini-3.1-pro-preview","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash"].includes(requestedModel)
        ? requestedModel : "gemini-2.5-flash";

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

    // ── OpenRouter (Groq / Meta / DeepSeek) ──────────────────────────────
    } else {
      const openrouter = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
        apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? "no-key",
      });

      const orMessages: any[] = [{ role: "system", content: systemPrompt }, ...chatMessages];

      // Attach images to last user message if present
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

    // Persist assistant reply
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
