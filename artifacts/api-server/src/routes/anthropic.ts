import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, settingsTable } from "@workspace/db";
import { SendAnthropicMessageBody, SendAnthropicMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as geminiAI } from "@workspace/integrations-gemini-ai";
import OpenAI from "openai";

const router: IRouter = Router();

// ── Provider helpers ─────────────────────────────────────────────────────────

function getModelProvider(model: string): "anthropic" | "gemini" | "groq" {
  if (model.startsWith("gemini")) return "gemini";
  if (
    model.startsWith("llama") ||
    model.startsWith("mixtral") ||
    model.startsWith("groq/") ||
    model.startsWith("meta-llama") ||
    model.startsWith("deepseek") ||
    model.startsWith("qwen")
  )
    return "groq";
  return "anthropic";
}

const ANTHROPIC_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
];

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

const GROQ_MODELS = [
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4-scout",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-r1",
  "qwen/qwen3-235b-a22b",
];

export const ALL_MODELS = [
  ...ANTHROPIC_MODELS.map((m) => ({ id: m, provider: "Claude (Anthropic)" })),
  ...GEMINI_MODELS.map((m) => ({ id: m, provider: "Gemini (Google)" })),
  ...GROQ_MODELS.map((m) => ({ id: m, provider: "OpenRouter" })),
];

// ── Streaming route ───────────────────────────────────────────────────────────

router.post("/conversations/:id/stream", async (req, res): Promise<void> => {
  const params = SendAnthropicMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendAnthropicMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const convId = params.data.id;

  const [settings] = await db.select().from(settingsTable).limit(1);
  const systemPrompt =
    settings?.systemPrompt ??
    "You are MaxxTech Agent, a powerful AI assistant built by CarlymaxX for tech and IT professionals. You write code, run scripts, search the web, and tackle complex technical problems.";

  const requestedModel = body.data.model ?? settings?.model ?? "claude-sonnet-4-6";
  const provider = getModelProvider(requestedModel);

  // Save user message
  const [userMsg] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, role: "user", content: body.data.content })
    .returning();
  void userMsg;

  await db
    .update(conversationsTable)
    .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  // Build chat history
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt);

  const chatMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let fullResponse = "";

  try {
    if (provider === "anthropic") {
      const safeModel = ANTHROPIC_MODELS.includes(requestedModel)
        ? requestedModel
        : "claude-sonnet-4-6";

      const stream = anthropic.messages.stream({
        model: safeModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages: chatMessages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
        }
      }
    } else if (provider === "gemini") {
      const safeModel = GEMINI_MODELS.includes(requestedModel)
        ? requestedModel
        : "gemini-2.5-flash";

      const geminiMessages = chatMessages.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

      const geminiStream = await geminiAI.models.generateContentStream({
        model: safeModel,
        systemInstruction: systemPrompt,
        contents: geminiMessages,
      });

      for await (const chunk of geminiStream) {
        const text = chunk.text ?? "";
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    } else {
      // Groq via OpenRouter (OpenAI-compatible)
      const openrouter = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
        apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? "no-key",
      });

      const stream = await openrouter.chat.completions.create({
        model: requestedModel,
        max_tokens: 8192,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    }

    // Persist assistant message
    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({ conversationId: convId, role: "assistant", content: fullResponse })
      .returning();

    await db
      .update(conversationsTable)
      .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
      .where(eq(conversationsTable.id, convId));

    res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMsg.id })}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  }

  res.end();
});

// ── Available models endpoint ─────────────────────────────────────────────────

router.get("/agent/models", async (_req, res): Promise<void> => {
  res.json({ models: ALL_MODELS });
});

export default router;
