# ── Build Stage ──
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native bcrypt
RUN apk add --no-cache python3 make g++

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Production Stage ──
FROM node:20-alpine

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/

# Default port (overridable via .env / docker-compose)
ENV PORT=4000

EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/api/system-info || exit 1

# Run as non-root user for security
USER node

CMD ["node", "src/server.js"]
