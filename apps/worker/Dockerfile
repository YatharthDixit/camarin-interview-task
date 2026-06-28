# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Copy workspace root files
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./

# Copy packages/db
COPY packages/db/package.json packages/db/
COPY packages/db/tsconfig.json packages/db/
COPY packages/db/prisma packages/db/prisma/
COPY packages/db/src packages/db/src/

# Copy apps/worker
COPY apps/worker/package.json apps/worker/
COPY apps/worker/tsconfig.json apps/worker/
COPY apps/worker/src apps/worker/src/

# Install all dependencies
RUN npm ci --ignore-scripts
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build packages/db
RUN npm run build -w packages/db

# Build worker
RUN npm run build -w apps/worker

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy package files for production install
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY apps/worker/package.json apps/worker/

# Copy Prisma schema before generating
COPY packages/db/prisma packages/db/prisma/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Copy built artifacts
COPY --from=builder /app/packages/db/dist packages/db/dist/
COPY --from=builder /app/apps/worker/dist apps/worker/dist/

# Switch to non-root user
USER appuser

# No ports exposed — internal network only
CMD ["node", "apps/worker/dist/index.js"]
