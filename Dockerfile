FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@10

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/maxxtech-agent/package.json ./artifacts/maxxtech-agent/
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build frontend
RUN pnpm --filter @workspace/maxxtech-agent run build

# Build API server
WORKDIR /app/artifacts/api-server
RUN pnpm run build

# Production image
FROM node:24-alpine AS production
WORKDIR /app

RUN npm install -g pnpm@10

COPY --from=base /app/artifacts/api-server/dist ./dist
COPY --from=base /app/artifacts/api-server/package.json ./
COPY --from=base /app/node_modules ./node_modules

# Serve frontend static files
COPY --from=base /app/artifacts/maxxtech-agent/dist ./public

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
