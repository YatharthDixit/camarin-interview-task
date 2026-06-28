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

# Copy apps/api
COPY apps/api/package.json apps/api/
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src/

# Copy apps/web (for building the frontend)
COPY apps/web/package.json apps/web/
COPY apps/web/tsconfig.json apps/web/
COPY apps/web/vite.config.ts apps/web/
COPY apps/web/index.html apps/web/
COPY apps/web/src apps/web/src/

# Install all dependencies
RUN npm ci --ignore-scripts
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build packages/db
RUN npm run build -w packages/db

# Build API
RUN npm run build -w apps/api

# Build web frontend
RUN npm run build -w apps/web

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
COPY apps/api/package.json apps/api/

# Copy Prisma schema before generating
COPY packages/db/prisma packages/db/prisma/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Copy built artifacts
COPY --from=builder /app/packages/db/dist packages/db/dist/
COPY --from=builder /app/apps/api/dist apps/api/dist/
COPY --from=builder /app/apps/web/dist apps/web/dist/

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/index.js"]
