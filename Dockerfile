FROM node:20-slim
WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

# Install Chrome to a shared path so both root (installing) and mcp (running) can find it
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chrome

# Copy built output
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN groupadd -r mcp && useradd -r -g mcp mcp
RUN chown -R mcp:mcp /app /ms-playwright
USER mcp

# Default to stdio transport
ENV TRANSPORT=stdio
ENV PORT=3000
ENV LOG_LEVEL=info
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
