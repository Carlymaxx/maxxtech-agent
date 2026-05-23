import { pgTable, serial, text, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull().default("MaxxTech Agent"),
  model: text("model").notNull().default("claude-3-5-sonnet-20241022"),
  systemPrompt: text("system_prompt").notNull().default("You are MaxxTech Agent, a powerful AI assistant for tech and IT professionals. You can answer questions, write and run code, search the web, automate tasks, and help with anything technical."),
  enableCodeExecution: boolean("enable_code_execution").notNull().default(true),
  enableWebSearch: boolean("enable_web_search").notNull().default(true),
  maxTokens: integer("max_tokens"),
  temperature: real("temperature"),
  theme: text("theme").notNull().default("dark"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
