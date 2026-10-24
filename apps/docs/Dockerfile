# Build context: repository root
#   docker build -f apps/docs/Dockerfile -t cloudrive/docs .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/docs/package.json apps/docs/
# The postinstall script runs fumadocs-mdx, which needs its config; the
# content arrives with the full copy below and is compiled by the build.
COPY apps/docs/source.config.ts apps/docs/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @cloudrive/docs
COPY apps/docs apps/docs
RUN pnpm --filter @cloudrive/docs run build

# In a workspace the standalone tree mirrors the repository layout, so the
# entrypoint is apps/docs/server.js and Next resolves .next/static next to it.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/docs/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/docs/.next/static ./apps/docs/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/docs/server.js"]
