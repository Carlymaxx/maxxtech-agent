# MaxxTech Agent

A self-hosted personal AI agent web app styled like Replit's AI agent — chat interface, tool calls, code execution, web search, and settings. Built for Tech/IT professionals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/maxxtech-agent run dev` — run the frontend (port from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle DB schema (conversations, messages, tool_calls, settings)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/maxxtech-agent/src/` — React frontend

## Architecture decisions

- All dates from Drizzle are serialized via `JSON.parse(JSON.stringify())` before Zod parse since Drizzle returns `Date` objects but OpenAPI spec uses `string` types
- Agent reply logic is server-side keyword matching (no external AI API key needed)
- Tool calls stored in `tool_calls` table and serialized as JSON in message `toolCalls` field
- Settings are a singleton row (always id=1), auto-created on first request

## Product

- Left sidebar: conversation history (pinned + recent), new chat button, settings link
- Main panel: chat interface with message bubbles, inline tool call cards (collapsible)
- Quick action chips: Run code, Search web, Explain this
- Settings page: agent name, model, system prompt, tools toggles, theme, max tokens, temperature

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after changing schema files
- Date serialization helper `serializeDates()` is needed in all route handlers before Zod parse
