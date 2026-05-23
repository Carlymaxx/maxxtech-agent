import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, settingsTable } from "@workspace/db";
import { SendAnthropicMessageBody, SendAnthropicMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

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
    "You are MaxxTech Agent, a powerful AI assistant for tech and IT professionals. You can answer questions, write and run code, search the web, automate tasks, and help with anything technical.";
  const model = body.data.model ?? settings?.model ?? "claude-sonnet-4-6";
  const allowedModels = [
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
  ];
  const safeModel = allowedModels.includes(model) ? model : "claude-sonnet-4-6";

  const [userMsg] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, role: "user", content: body.data.content })
    .returning();

  await db
    .update(conversationsTable)
    .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt);

  const chatMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let fullResponse = "";

  try {
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

    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
      })
      .returning();

    await db
      .update(conversationsTable)
      .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
      .where(eq(conversationsTable.id, convId));

    res.write(
      `data: ${JSON.stringify({ done: true, messageId: assistantMsg.id })}\n\n`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  }

  res.end();
});

export default router;
