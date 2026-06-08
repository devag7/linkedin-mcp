FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build
RUN npm run build

# Production stage — minimal image
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

# Copy built output
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp

# Default to stdio transport
ENV TRANSPORT=stdio
ENV PORT=3000
ENV LOG_LEVEL=info

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
