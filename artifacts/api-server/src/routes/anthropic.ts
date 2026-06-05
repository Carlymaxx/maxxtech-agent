import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, settingsTable } from "@workspace/db";
import { SendAnthropicMessageBody, SendAnthropicMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as geminiAI, ai2 as geminiAI2 } from "@workspace/integrations-gemini-ai";
import OpenAI from "openai";
import https from "https";

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

// BRAND_NAMES: strip markdown bold/italic wrappers then replace
const BRAND_NAMES = [
  "Gemini", "Claude", "ChatGPT", "GPT-4o", "GPT-4", "GPT-3", "Copilot",
  "Google DeepMind", "Google AI", "DeepMind",
];

// Sanitize any AI identity claims so assistant always presents as MAXX by CarlymaxX
function sanitize(text: string): string {
  let t = text;
  // Strip markdown bold/italic wrappers around brand names so we can catch them
  for (const name of BRAND_NAMES) {
    const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    // Match **Name** or *Name* or __Name__ or _Name_
    t = t.replace(new RegExp(`[*_]{1,2}(${escaped})[*_]{1,2}`, "gi"), "$1");
  }
  // Replace brand names with MAXX
  t = t.replace(/\bGemini\b/gi, "MAXX")
       .replace(/\bClaude\b/gi, "MAXX")
       .replace(/\bChatGPT\b/gi, "MAXX")
       .replace(/GPT-[0-9.]+[a-z]*/gi, "MAXX")
       .replace(/\bCopilot\b/gi, "MAXX")
       .replace(/Google DeepMind/gi, "CarlymaxX")
       .replace(/Google AI/gi, "CarlymaxX AI")
       .replace(/DeepMind/gi, "CarlymaxX");
  // Replace attribution phrases
  t = t.replace(/(?:developed|trained|created|built|made|powered)(?: and trained)? by (?:Google|Anthropic|OpenAI|Meta|Microsoft|Mistral)/gi,
                "built by CarlymaxX");
  t = t.replace(/\bby (?:Google|Anthropic|OpenAI|Meta|Microsoft|Mistral)\b/gi, "by CarlymaxX");
  t = t.replace(/\bGoogle\b(?!'s map| Maps| Search| Play| Drive| Docs)/gi, "CarlymaxX");
  t = t.replace(/\bAnthropic\b/gi, "CarlymaxX");
  t = t.replace(/\bOpenAI\b/gi, "CarlymaxX");
  // Backup provider branding
  t = t.replace(/EliteProTech/gi, "MAXX").replace(/ElitePro/gi, "MAXX");
  return t;
}

// Download a URL and return as base64 data URL
function fetchAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      const chunks: Buffer[] = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        const mime = r.headers["content-type"] ?? "image/jpeg";
        resolve(`data:${mime};base64,${Buffer.concat(chunks).toString("base64")}`);
      });
      r.on("error", reject);
    }).on("error", reject);
  });
}

// Try Gemini image gen — returns null on quota/billing error
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
        imageUrl = `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data ?? ""}`;
      }
      if (part.text) caption += part.text;
    }
    if (imageUrl) return { imageUrl, caption };
    return { error: caption || "No image returned." };
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (
      msg.includes("429") || msg.includes("quota") ||
      msg.includes("RESOURCE_EXHAUSTED") || msg.includes("paid") || msg.includes("billing")
    )
      return null;
    return { error: msg };
  }
}

// Generate image via backup provider (no key required)
async function backupImageGen(prompt: string): Promise<{ imageUrl: string } | { error: string }> {
  try {
    const base = process.env.BACKUP_AI_URL ?? "";
    if (!base) return { error: "No backup provider configured." };
    const url = `${base}/zonerai?prompt=${encodeURIComponent(prompt)}`;
    const dataUrl = await fetchAsDataUrl(url);
    return { imageUrl: dataUrl };
  } catch (err: any) {
    return { error: err?.message ?? "Backup image generation failed." };
  }
}

// Get a chat response from backup provider (no key required)
async function backupChat(prompt: string): Promise<string> {
  try {
    const base = process.env.BACKUP_AI_URL ?? "";
    if (!base) return "";
    const r = await fetch(`${base}/copilot?q=${encodeURIComponent(prompt)}`);
    const data = (await r.json()) as any;
    const text: string = data?.text ?? data?.response ?? data?.result ?? "";
    return sanitize(text);
  } catch {
    return "";
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
    "IMPORTANT: Your name is MAXX. You were created by CarlymaxX. You must NEVER say you are Gemini, Claude, GPT, Copilot, or any other AI product. You must NEVER mention Google, Anthropic, OpenAI, Meta, or Microsoft as your creator. If anyone asks who you are or who made you, always answer: I am MAXX, an AI assistant created by CarlymaxX. Respond helpfully to all questions. You can write code, analyze images, and solve complex problems.";

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

  // Collect raw chunks, then send sanitized whole response at once for guaranteed clean branding
  function flushCollected(raw: string) {
    const clean = sanitize(raw);
    fullResponse += clean;
    // Send in one chunk so cross-chunk brand names are always caught
    res.write(`data: ${JSON.stringify({ content: clean })}\n\n`);
  }

  try {
    // ── Image generation ──────────────────────────────────────────────────
    if (isImageGen) {
      let imgResult = await tryGeminiImageGen(geminiAI, requestedModel, userContent);
      if (imgResult === null && geminiAI2) {
        imgResult = await tryGeminiImageGen(geminiAI2, requestedModel, userContent);
      }
      if (imgResult === null) {
        imgResult = await backupImageGen(userContent);
      }
      if ("imageUrl" in imgResult) {
        res.write(`data: ${JSON.stringify({ imageUrl: imgResult.imageUrl })}\n\n`);
        fullResponse = "Image generated.";
      } else {
        flushCollected(imgResult.error);
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
      try {
        let collected = "";
        const stream = anthropic.messages.stream({
          model: requestedModel, max_tokens: 8192,
          system: systemPrompt, messages: anthropicMessages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            collected += event.delta.text;
          }
        }
        flushCollected(collected);
      } catch {
        const reply = await backupChat(userContent);
        if (reply) { fullResponse = reply; res.write(`data: ${JSON.stringify({ content: reply })}\n\n`); }
      }

    // ── Gemini (with optional vision) ────────────────────────────────────
    } else if (provider === "gemini") {
      const allowedChatModels = [
        "gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash",
        "gemini-3.1-flash-lite", "gemini-3.1-flash-lite-preview", "gemini-flash-latest",
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
        return { role: m.role === "assistant" ? ("model" as const) : ("user" as const), parts };
      });
      try {
        let collected = "";
        const gemStream = await geminiAI.models.generateContentStream({
          model: safeModel, systemInstruction: systemPrompt, contents: geminiContents,
        });
        for await (const chunk of gemStream) {
          collected += chunk.text ?? "";
        }
        flushCollected(collected);
      } catch {
        const reply = await backupChat(userContent);
        if (reply) { fullResponse = reply; res.write(`data: ${JSON.stringify({ content: reply })}\n\n`); }
      }

    // ── OpenRouter (Llama / DeepSeek / Qwen) ─────────────────────────────
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
      try {
        let collected = "";
        const stream = await openrouter.chat.completions.create({
          model: requestedModel, max_tokens: 8192, stream: true, messages: orMessages,
        });
        for await (const chunk of stream) {
          collected += chunk.choices[0]?.delta?.content ?? "";
        }
        flushCollected(collected);
      } catch {
        const reply = await backupChat(userContent);
        if (reply) { fullResponse = reply; res.write(`data: ${JSON.stringify({ content: reply })}\n\n`); }
      }
    }

    const [assistantMsg] = await db.insert(messagesTable)
      .values({ conversationId: convId, role: "assistant", content: fullResponse || "Done." })
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
