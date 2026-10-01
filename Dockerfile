# Experimental Linux recipe. Not a verified deployment/first-login path.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx patchright install --with-deps chrome && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY LICENSE README.md ./
USER node
ENV TRANSPORT=stdio LOG_LEVEL=info LINKEDIN_ENABLE_WRITES=false
ENTRYPOINT ["node", "dist/index.js"]
