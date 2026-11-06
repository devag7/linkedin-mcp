# Experimental Linux recipe. Not a verified deployment/first-login path.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.34.9 && pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY scripts/build.mjs ./scripts/
COPY src/ ./src/
RUN pnpm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.34.9 && pnpm install --frozen-lockfile --prod \
 && pnpm exec patchright install --with-deps chrome && pnpm store prune && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY LICENSE README.md ./
USER node
ENV TRANSPORT=stdio LOG_LEVEL=info LINKEDIN_ENABLE_WRITES=false
ENTRYPOINT ["node", "dist/index.js"]
