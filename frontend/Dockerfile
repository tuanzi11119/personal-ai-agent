# Personal AI Agent Platform - frontend image (Next.js server)
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.28.5
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# NPM_REGISTRY lets a China-region deploy use a local mirror
# (compose passes it through from .env; default is upstream npmjs).
ARG NPM_REGISTRY=https://registry.npmjs.org
# strict-dep-builds=false: pnpm 11 otherwise exits 1 when optional native
# scripts (sharp) are skipped, which aborts the image build for no good reason.
RUN pnpm install --frozen-lockfile --registry="$NPM_REGISTRY" --config.strict-dep-builds=false

FROM base AS builder
# IMPORTANT: next.config.ts rewrites("/api/*") are compiled into
# .next/routes-manifest.json at BUILD time, so BACKEND_URL must be a build arg.
# Setting it only at runtime (docker compose environment:) has no effect.
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Call the Next binary directly: pnpm run build would run its pre-flight install
# inside the image, which adds nothing here and can trip over ignored build scripts.
RUN node node_modules/next/dist/bin/next build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY package.json next.config.ts tsconfig.json ./
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
