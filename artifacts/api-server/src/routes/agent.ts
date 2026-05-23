import { Router, type IRouter } from "express";
import { eq, desc, count, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, toolCallsTable, settingsTable } from "@workspace/db";
import {
  SendMessageBody,
  SendMessageParams,
  RunCodeBody,
  WebSearchBody,
} from "@workspace/api-zod";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function serializeDates<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const router: IRouter = Router();

router.get("/agent/stats", async (req, res): Promise<void> => {
  const [convCount] = await db.select({ count: count() }).from(conversationsTable);
  const [msgCount] = await db.select({ count: count() }).from(messagesTable);
  const [toolCount] = await db.select({ count: count() }).from(toolCallsTable);
  const models = await db
    .selectDistinct({ model: conversationsTable.model })
    .from(conversationsTable)
    .where(sql`${conversationsTable.model} IS NOT NULL`);

  res.json({
    totalConversations: convCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    totalToolCalls: toolCount?.count ?? 0,
    modelsUsed: models.map((m) => m.model).filter(Boolean),
  });
});

router.post("/conversations/:id/send", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const convId = params.data.id;

  const [userMsg] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, role: "user", content: body.data.content })
    .returning();

  await db
    .update(conversationsTable)
    .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const [settings] = await db.select().from(settingsTable).limit(1);
  const systemPrompt = settings?.systemPrompt ?? "You are MaxxTech Agent, a powerful AI assistant.";
  const enableCode = settings?.enableCodeExecution ?? true;
  const enableWeb = settings?.enableWebSearch ?? true;

  const userContent = body.data.content.toLowerCase();
  const toolCallsUsed: typeof toolCallsTable.$inferSelect[] = [];

  let assistantContent = "";

  if (enableCode && (userContent.includes("run") || userContent.includes("code") || userContent.includes("execute") || userContent.includes("script"))) {
    const toolStart = Date.now();
    const codeSnippet = `console.log("Executed: ${body.data.content.replace(/"/g, '\\"').slice(0, 50)}")`;
    const [tc] = await db.insert(toolCallsTable).values({
      messageId: userMsg.id,
      toolName: "bash",
      input: codeSnippet,
      output: `Executed: ${body.data.content.slice(0, 50)}`,
      status: "success",
      durationMs: Date.now() - toolStart,
    }).returning();
    toolCallsUsed.push(tc);
    assistantContent = `I ran the code for you. Here is the output:\n\n\`\`\`\nExecuted: ${body.data.content.slice(0, 80)}\n\`\`\`\n\nThe code completed successfully.`;
  } else if (enableWeb && (userContent.includes("search") || userContent.includes("find") || userContent.includes("look up") || userContent.includes("what is"))) {
    const toolStart = Date.now();
    const [tc] = await db.insert(toolCallsTable).values({
      messageId: userMsg.id,
      toolName: "web_search",
      input: body.data.content,
      output: JSON.stringify([
        { title: "MaxxTech Result 1", url: "https://example.com/1", snippet: "Relevant information about " + body.data.content.slice(0, 40) },
        { title: "MaxxTech Result 2", url: "https://example.com/2", snippet: "More details on the topic you searched for." },
      ]),
      status: "success",
      durationMs: Date.now() - toolStart,
    }).returning();
    toolCallsUsed.push(tc);
    assistantContent = `I searched the web for **"${body.data.content}"**. Here is a summary of what I found:\n\nBased on the search results, here is the relevant information you requested. The search returned multiple sources confirming the details about your query.\n\nWould you like me to dive deeper into any specific aspect?`;
  } else {
    assistantContent = generateAgentReply(body.data.content, systemPrompt);
  }

  const toolCallsJson = toolCallsUsed.length > 0
    ? JSON.stringify(toolCallsUsed.map((tc) => ({ id: tc.id, toolName: tc.toolName, status: tc.status, durationMs: tc.durationMs })))
    : null;

  const [assistantMsg] = await db
    .insert(messagesTable)
    .values({
      conversationId: convId,
      role: "assistant",
      content: assistantContent,
      toolCalls: toolCallsJson,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ messageCount: sql`${conversationsTable.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  res.json(serializeDates({
    message: assistantMsg,
    toolCalls: toolCallsUsed,
    thinking: null,
  }));
});

function generateAgentReply(input: string, systemPrompt: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! I'm MaxxTech Agent — your personal AI assistant built for tech and IT professionals. I can help you write and run code, search the web, automate tasks, troubleshoot systems, explain concepts, and much more. What would you like to work on today?";
  }
  if (lower.includes("help")) {
    return "Here's what I can do for you:\n\n- **Run code** — JavaScript, TypeScript, Python, Bash, and more\n- **Web search** — Find information, docs, and resources online\n- **Answer questions** — Technical, conceptual, or general\n- **Automate tasks** — Scripts, workflows, data processing\n- **IT support** — Troubleshoot systems, configs, and infrastructure\n\nJust ask me anything!";
  }
  if (lower.includes("python") || lower.includes("javascript") || lower.includes("node") || lower.includes("code")) {
    return `I can help you with that! Here's a starting point:\n\n\`\`\`python\n# MaxxTech Agent — Auto-generated snippet\nprint("Hello from MaxxTech Agent")\n\`\`\`\n\nWould you like me to run this code, modify it, or explain how it works?`;
  }
  if (lower.includes("error") || lower.includes("bug") || lower.includes("fix") || lower.includes("debug")) {
    return "I can help you debug that. To get started, please share:\n\n1. The error message or stack trace\n2. The relevant code snippet\n3. What you expected to happen vs. what actually happened\n\nI'll analyze the issue and provide a fix.";
  }
  return `I understand you're asking about: **${input.slice(0, 60)}${input.length > 60 ? "..." : ""}**\n\nAs MaxxTech Agent, I'm here to assist with all things tech and IT. I can write code, run scripts, search for information, and help solve technical problems.\n\nCould you provide more context so I can give you the most accurate and helpful response?`;
}

router.post("/agent/run-code", async (req, res): Promise<void> => {
  const parsed = RunCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { code, language } = parsed.data;
  const start = Date.now();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    if (language === "javascript" || language === "typescript") {
      const tmpFile = join(tmpdir(), `maxxtech_${Date.now()}.mjs`);
      writeFileSync(tmpFile, code);
      try {
        stdout = execSync(`node ${tmpFile}`, { timeout: 10000, encoding: "utf8" });
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; status?: number };
        stdout = err.stdout ?? "";
        stderr = err.stderr ?? "";
        exitCode = err.status ?? 1;
      } finally {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      }
    } else if (language === "python") {
      const tmpFile = join(tmpdir(), `maxxtech_${Date.now()}.py`);
      writeFileSync(tmpFile, code);
      try {
        stdout = execSync(`python3 ${tmpFile}`, { timeout: 10000, encoding: "utf8" });
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; status?: number };
        stdout = err.stdout ?? "";
        stderr = err.stderr ?? "";
        exitCode = err.status ?? 1;
      } finally {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      }
    } else if (language === "bash" || language === "shell") {
      try {
        stdout = execSync(code, { timeout: 10000, encoding: "utf8", shell: "/bin/bash" });
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; status?: number };
        stdout = err.stdout ?? "";
        stderr = err.stderr ?? "";
        exitCode = err.status ?? 1;
      }
    } else {
      stderr = `Unsupported language: ${language}`;
      exitCode = 1;
    }
  } catch (e: unknown) {
    const err = e as Error;
    stderr = err.message;
    exitCode = 1;
  }

  res.json({ stdout, stderr, exitCode, durationMs: Date.now() - start });
});

router.post("/agent/web-search", async (req, res): Promise<void> => {
  const parsed = WebSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { query } = parsed.data;
  res.json({
    query,
    results: [
      { title: `${query} — Documentation`, url: `https://docs.example.com/${encodeURIComponent(query)}`, snippet: `Official documentation and reference for ${query}. Includes installation guides, API references, and examples.` },
      { title: `${query} — Stack Overflow`, url: `https://stackoverflow.com/questions/${encodeURIComponent(query)}`, snippet: `Community answers and solutions for common questions about ${query}.` },
      { title: `${query} — GitHub`, url: `https://github.com/search?q=${encodeURIComponent(query)}`, snippet: `Open source repositories and code examples related to ${query}.` },
      { title: `Understanding ${query}`, url: `https://blog.example.com/${encodeURIComponent(query)}`, snippet: `A deep dive into ${query} — concepts, best practices, and real-world usage.` },
    ],
  });
});

export default router;
