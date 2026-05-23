import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const toolCallsTable = pgTable("tool_calls", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id"),
  toolName: text("tool_name").notNull(),
  input: text("input"),
  output: text("output"),
  status: text("status").notNull().default("success"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertToolCallSchema = createInsertSchema(toolCallsTable).omit({ id: true, createdAt: true });
export type InsertToolCall = z.infer<typeof insertToolCallSchema>;
export type ToolCall = typeof toolCallsTable.$inferSelect;
