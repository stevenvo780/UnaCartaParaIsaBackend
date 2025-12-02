FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# Install ALL dependencies
RUN npm ci

# Copy application code
COPY src ./src
COPY tsconfig.json ./

# Remove build tools (keep tsx for runtime)
RUN apk del python3 make g++

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Use tsx to run TypeScript directly (handles ESM imports correctly)
CMD ["sh", "-c", "cd /app && npx tsx src/application/server.ts"]
