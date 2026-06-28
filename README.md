# Camarin — AI-Powered Media Processing Microservice

Camarin is a full-stack microservice that accepts user-uploaded images, processes them asynchronously through a multi-step AI pipeline, and returns enriched structured metadata — all without blocking the user.

Users upload an image, get a Job ID back immediately, and watch their results arrive in real-time via Server-Sent Events. In the background, a worker downloads the image, calls Google Cloud Vision for object detection and content safety, then calls HuggingFace for a natural-language caption. Results are stored in PostgreSQL and pushed to the browser the moment they're ready.

---

## 🚀 Live Deployment

The application is deployed and live at: **[https://camarin.yath.dev](https://camarin.yath.dev)**

This project has been fully upgraded to a **production-ready architecture**:
- **CI/CD Pipeline**: GitHub Actions automatically builds multi-stage Docker images on every push, pushes them to GitHub Container Registry (GHCR), and securely deploys them to a remote VPS via SSH.
- **Production VPS Setup**: Hosted on an isolated VPS utilizing Docker Compose for orchestration.
- **Reverse Proxy**: Nginx handles SSL termination (Certbot) and routes traffic to the API container, with custom headers perfectly tuned for Server-Sent Events (SSE).
- **Monorepo Migration**: The codebase was heavily refactored into a scalable NPM Workspaces monorepo (`apps/api`, `apps/worker`, `apps/web`, `packages/db`), ensuring strong boundaries and type-sharing.
- **Dockerized**: Containerized down to lightweight Alpine Linux images running as non-root users for maximum security.

---

## Table of Contents

1. [Quick Start for Reviewers](#quick-start-for-reviewers)
2. [Local Development (HMR)](#local-development-hmr)
3. [Environment Variables](#environment-variables)
4. [Obtaining API Keys](#obtaining-api-keys)
5. [Architecture](#architecture)
6. [AI Pipeline Deep-Dive](#ai-pipeline-deep-dive)
7. [Design Decisions](#design-decisions)
8. [Security](#security)
9. [API Reference](#api-reference)
10. [Testing](#testing)
11. [Scalability Notes](#scalability-notes)
12. [Known Limitations](#known-limitations)

---

## Quick Start for Reviewers

**Prerequisites:** Docker Desktop (or Docker Engine + Compose v2). Nothing else required on the host.

```bash
# 1. Clone the repository
git clone https://github.com/YatharthDixit/camarin-interview-task.git && cd camarin-interview-task

# 2. Add your environment variables
# Copy the `.env` file provided in the email and place it in the root directory.
# This contains all the necessary API keys to review the app.

# 3. Start the application (builds images, runs migrations, starts services)
docker compose up --build
```

Open **http://localhost:4000** in your browser. The full stack is live:
- React SPA (served by the API container)
- Express API on port 4000
- BullMQ worker processing jobs in the background
- PostgreSQL + Redis in isolated containers

**To create an account:** click "Create one" on the login screen, sign up with any email and password (≥ 8 chars), then upload a JPG, PNG, or WEBP image (≤ 5 MB). Watch the status badge update in real-time without any page refresh.

---

## Local Development (HMR)

For code editing with hot-reload on the frontend and `tsx watch` on the backend:

```bash
# 1. Start only the infrastructure services (Postgres + Redis)
docker compose -f docker-compose.dev.yml up -d

# 2. Install dependencies
npm install

# 3. Run the first database migration
npm run db:migrate -w packages/db

# 4. Start all three apps in parallel
npm run dev
```

| Service | URL |
|---------|-----|
| React SPA (Vite) | http://localhost:5173 |
| Express API | http://localhost:3000 |
| Worker | no HTTP — runs as a background process |

The Vite dev server proxies `/api` to `http://localhost:3000` so there are no CORS issues in development.

---

## Environment Variables

Copy the `.env` file provided in the email and place it in the root directory. It contains all the required API keys and configuration to run the application seamlessly.

If you are setting this up from scratch, refer to `.env.example` for the required variables:

| Variable | Used by | Required |
|----------|---------|----------|
| `DATABASE_URL` | API + Worker | Yes |
| `POSTGRES_*` | Docker Compose only | Yes |
| `REDIS_URL` | API + Worker | Yes |
| `JWT_SECRET` | API only | Yes — min 32 chars |
| `JWT_ACCESS_EXPIRY` | API only | No — default `15m` |
| `JWT_REFRESH_EXPIRY` | API only | No — default `30d` |
| `R2_*` | API + Worker | Yes |
| `HF_API_KEY` | Worker only | Yes |
| `GOOGLE_VISION_API_KEY` | Worker only | Yes |

Both the API and worker validate their required variables on startup. They will crash with a clear error message if anything is missing, preventing silent failures.

---

## Obtaining API Keys

*(Note: You can skip this section if you use the `.env` provided in the email.)*

### Hugging Face (free)
1. Create an account at [huggingface.co](https://huggingface.co)
2. Generate an Access Token with **"Make calls to Inference Providers"** permissions.

### Google Cloud Vision (free tier)
1. Enable the **Cloud Vision API** in your Google Cloud Console.
2. Create an API Key in the Credentials section.

### Cloudflare R2 (free tier)
1. Create an R2 bucket named `camarin-uploads` in the Cloudflare Dashboard.
2. Generate an R2 API Token with **Object Read & Write** permissions.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser (React SPA)                             │
│                                                                          │
│   ┌──────────┐   ┌──────────────┐   ┌─────────────────────────────────┐ │
│   │  Auth    │   │  Dashboard   │   │  Job Detail                     │ │
│   │ (Login / │   │  (Upload +   │   │  (Image + Caption + Labels +    │ │
│   │  Signup) │   │   Job List)  │   │   Safety + Retry)               │ │
│   └────┬─────┘   └──────┬───────┘   └──────────────┬──────────────────┘ │
│        │                │                           │                    │
│        └────────────────┴───────────────────────────┘                   │
│                         │ HTTPS (cookie auth)  ↑ SSE stream             │
└─────────────────────────┼──────────────────────┼───────────────────────-┘
                          │                      │
            ┌─────────────▼──────────────────────┴─────────────┐
            │                  Express API                       │
            │                                                    │
            │  • Helmet (CSP, security headers)                  │
            │  • Rate limiting (Redis-backed, per-IP)            │
            │  • Zod validation + centralized error handler      │
            │  • JWT auth middleware (HttpOnly cookies)          │
            │  • Multer + magic-byte file validation             │
            │  • SSE controller (Redis pub/sub subscriber)       │
            └──────┬──────────────────────────┬─────────────────┘
                   │                          │
         ┌─────────▼──────────┐   ┌──────────▼──────────┐
         │   PostgreSQL 16    │   │      Redis 7          │
         │                    │   │                       │
         │  • Users           │   │  • BullMQ queues      │
         │  • Jobs            │   │  • Rate limit state   │
         │  • JobResults      │   │  • SSE pub/sub        │
         │  • RefreshTokens   │   │                       │
         └────────────────────┘   └──────────┬────────────┘
                                             │
                              ┌──────────────▼──────────────┐
                              │        BullMQ Worker         │
                              │                              │
                              │  1. Download from R2         │
                              │  2. Resize → JPEG (sharp)   │
                              │  3. Google Vision (1 call)  │
                              │     ├─ Labels               │
                              │     └─ SafeSearch           │
                              │  4a. Flagged? → done        │
                              │  4b. HuggingFace VLM        │
                              │      (3× retry on 503)      │
                              │      └─ Fallback: labels    │
                              │  5. Write result to PG      │
                              │  6. Publish SSE event       │
                              └──────────────┬──────────────┘
                                             │
                              ┌──────────────▼──────────────┐
                              │       Cloudflare R2          │
                              │  (original images, durable,  │
                              │   served via presigned URLs) │
                              └─────────────────────────────┘
```

### Repository Structure

```
camarin/
├── apps/
│   ├── api/                    # Express API server
│   │   ├── src/
│   │   │   ├── controllers/    # Thin request handlers
│   │   │   ├── middleware/     # auth, upload, validate, error-handler, rate-limit
│   │   │   ├── routes/         # Route registration
│   │   │   ├── schemas/        # Zod schemas (one per endpoint group)
│   │   │   ├── services/       # storage.service.ts (R2 presign/upload)
│   │   │   └── lib/            # env, jwt, cookies, errors, logger, queue, response
│   │   └── Dockerfile
│   │
│   ├── worker/                 # BullMQ consumer
│   │   ├── src/
│   │   │   ├── providers/      # google-vision.ts, huggingface.ts
│   │   │   ├── fallback/       # pool.ts — label-based caption fallback
│   │   │   ├── lib/            # env, logger (job-scoped), r2, resize, publisher
│   │   │   ├── pipeline.ts     # Main AI processing logic
│   │   │   └── processor.ts    # Job lifecycle and routing
│   │   └── Dockerfile
│   │
│   └── web/                    # React + Vite SPA
│       └── src/
│           ├── pages/          # Dashboard, JobDetail, Login, Signup
│           ├── components/     # UI components (JobCard, UploadZone, etc.)
│           ├── contexts/       # AuthContext
│           ├── hooks/          # Custom hooks (useJobStream, useFileUpload, etc.)
│           └── api/            # client.ts (typed API client)
│
├── packages/
│   └── db/                     # Shared Prisma client + service layer
│       ├── prisma/schema.prisma
│       └── src/
│           ├── client.ts
│           └── services/       # user, job, jobResult, refreshToken services
│
├── docker-compose.yml          # Production-style: loopback-bound ports, mem limits
├── docker-compose.dev.yml      # Dev: only Postgres + Redis, with host ports
└── .github/workflows/          # CI/CD (lint → typecheck → test → build → deploy)
```

---

## AI Pipeline Deep-Dive

```
Job dequeued
     │
     ▼
1. Download image from R2
     │
     ▼
2. Resize + normalize to JPEG (sharp, long edge ≤ 1568px)
   └── resizing before any API call reduces payload size, latency, and cost
     │
     ▼
3. ONE Google Vision API call: { LABEL_DETECTION, SAFE_SEARCH_DETECTION }
   └── single combined call — we need both anyway, and two calls would
       double latency and cost for no benefit
     │
     ├─── SafeSearch: any category LIKELY or VERY_LIKELY?
     │         │
     │        YES ──► write { flagged: true, flaggedCategory, labels }
     │                      publish FLAGGED_NOTIFICATION event to SSE
     │                      status = COMPLETED — done
     │         │
     │        NO
     │         │
     ▼
4. HuggingFace VLM captioning
   Model: Qwen/Qwen3-VL-8B-Instruct via Novita inference provider
   └── 3-attempt retry loop:
       - on 503/429: parse estimated_time, sleep, retry
       - on 3rd failure: fall through to label-based caption
       - on non-retriable error (4xx): throw immediately
     │
     ├─── HF succeeded → caption = model output
     │
     └─── HF failed all 3 attempts → caption = label-based fallback
          ("an image of dog, park, and sunlight" — from Vision labels)
     │
     ▼
5. Write { caption, labels, flagged: false } to JobResult
   Publish JOB_UPDATE event
   status = COMPLETED
```

**Why the fallback never blocks completion:** A failed HF call is a soft error — the Vision labels are already available and contain enough signal for a useful caption. The job always reaches COMPLETED or FAILED. It never stays stuck in PROCESSING because HF is down.

**Idempotency:** BullMQ's stalled-job recovery can redeliver a job if the worker crashes mid-processing. The Vision call result is written atomically with the job status using Prisma's nested `upsert`, so a redelivered job that gets to the Vision step will overwrite identically — no duplicate billing.

---

## Design Decisions

### Monorepo with npm workspaces (not Turborepo/Nx)

npm workspaces gave us shared packages (`@camarin/db`), a single `node_modules`, and root-level lint/typecheck/test scripts — everything needed for a 3-package repo. Turborepo's caching and parallelism only pays off when you have many packages or a slow build pipeline. For this project size, it would be complexity without benefit.

### PostgreSQL over MongoDB

The data model is relational: `User → Job → JobResult → RefreshToken`. These have hard foreign key constraints (a JobResult without a Job is meaningless; deleting a user should cascade). PostgreSQL's `onDelete: Cascade`, transactions, and indexes on compound predicates (`userId + status`, `userId + createdAt`) are exactly the right tool. MongoDB's flexible schema offers nothing here — the schema is known and fixed.

### Service layer in `packages/db`, not duplicated per app

Both the API and the worker read and write job state. They have to agree exactly on what "flagged and completed" means. Writing that logic in two places — once in the API, once in the worker — guarantees drift. The service functions (`markProcessing`, `markFlaggedCompleted`, `markCaptionedCompleted`, `markFailed`, `retryJob`) live once in `packages/db/src/services/job.service.ts` and are imported by both apps. Neither app calls `prisma.job.*` directly.

This is not a repository-interface pattern or DI container — it's plain typed functions. Prisma is already the data-access abstraction.

### BullMQ + Redis for the queue

BullMQ gave us everything we needed without custom code:
- **Stalled-job recovery**: workers extend a lock on active jobs; if a worker is OOM-killed without sending SIGTERM, the lock expires and another worker picks up the job automatically
- **Exponential backoff**: the queue retries failed jobs with `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }` at the queue level — the worker doesn't need to implement retry loops for infrastructure failures (only for HF 503s, which are expected)
- **Concurrency control**: `concurrency: 5` in the BullMQ worker handles 5 jobs in parallel — mostly waiting on network I/O, not CPU

### Cloudflare R2 for storage

Serving images from the API container would mean every image view burns CPU and bandwidth on a single VPS. R2 hands that off to Cloudflare's edge for free (zero egress fees). The alternative — AWS S3 — costs $0.09/GB egress and would be noticeably expensive under any real traffic.

**Why presigned URLs, not public bucket access:** the spec mentions scanned documents. A permanent public URL for a document is a privacy liability regardless of how obscure the filename is. Presigned GET URLs expire in 15 minutes and are generated only for the authenticated job owner.

### Server-Sent Events, not WebSockets

Job status updates flow in one direction: server → browser. SSE is exactly this pattern. WebSockets add bidirectional channels, connection upgrade negotiation, and significant bundle overhead (Socket.io) for something that needs none of it. SSE is a plain HTTP connection with a `text/event-stream` content type — it works through proxies, requires no library, and degrades gracefully.

The one gotcha: nginx defaults to a 60-second `proxy_read_timeout`, which silently kills idle SSE connections. The nginx config sets `proxy_read_timeout 86400s` on the `/api/jobs/stream` location, and the server sends a comment heartbeat every 20 seconds as defense-in-depth against any other intermediary timeout.

### JWT in HttpOnly cookies, not localStorage

Storing tokens in `localStorage` exposes them to any JavaScript running on the page — including injected ads, browser extensions, or XSS payloads. `HttpOnly` cookies are never accessible to JavaScript at all. The `SameSite: strict` attribute prevents CSRF. The `secure` flag ensures cookies only travel over HTTPS in production.

The refresh token cookie's `path` is restricted to `/api/auth/refresh` so it's never sent on image requests, API calls, or any other route — the minimal possible exposure.

### Refresh token rotation with reuse detection

Rotation alone (single-use tokens) delays a thief. Reuse detection is what actually catches one. When a refresh token that has already been rotated is presented again, it means someone has a copy of a token that was already consumed — strong signal of theft. The response is to revoke the entire token family (all sessions for that login chain), forcing the user to log in fresh.

The token is stored as a `sha256` hash, not plaintext — a DB leak doesn't hand out usable sessions.

### Argon2id for password hashing

Argon2id is the OWASP-recommended algorithm. Parameters: `m=19456` (19 MiB memory cost), `t=2` (time cost), `p=1` (parallelism). The implementation uses `@node-rs/argon2` (Rust-backed native bindings) rather than the pure-JS `argon2` package — meaningfully faster under concurrent login load, which matters when the auth endpoints also have a tight rate limit (10/15min/IP).

### One Google Vision call for both labels and SafeSearch

Two earlier designs considered calling Vision twice — once for SafeSearch, once for labels. That would double Vision API usage and add a full round-trip of latency on every job. The Vision API accepts multiple `features` in one request. We always need both outputs, so the decision is: one combined call, gate only the HF step on the SafeSearch result.

### Label-based caption fallback

The HuggingFace inference layer is an external dependency that can return 503s during model loading, rate limit, or simply be unavailable. A job that cannot be captioned should still complete — the Vision labels (which are already available and free at that point) contain enough signal to generate a useful description: "an image of dog, park, sunlight, and leash." This is not as rich as a VLM caption, but it means the job always reaches COMPLETED and the user sees results.

### React + Vite for the frontend

Create React App is deprecated. Vite's dev server starts in milliseconds and HMR is near-instant. The SPA is built as static files and served by the API container in production — no CORS, no separate static server, no additional infrastructure.

### Pino for logging

Pino is the fastest Node.js logger. More importantly, it emits structured JSON, which means logs can be filtered, aggregated, and searched in any log management tool without parsing. The worker creates a child logger per job (`logger.child({ jobId })`), so every line emitted during that job's processing automatically carries the `jobId` field — the difference between grepping an hour of interleaved logs and filtering by one field.

---

## Security

| Control | Implementation |
|---------|---------------|
| Password hashing | Argon2id, OWASP baseline params (m=19456, t=2, p=1) |
| JWT signing | HS256, `algorithms: ['HS256']` pinned at verify — prevents alg:none attacks |
| Refresh tokens | Stored as SHA-256 hash; single-use; reuse triggers full family revocation |
| Cookie security | `HttpOnly`, `Secure` (production), `SameSite: strict`, refresh scoped to `/api/auth/refresh` |
| File upload | Magic-byte validation via `file-type` — rejects renamed executables regardless of Content-Type |
| File size | Enforced at both multer (5 MB) and nginx (`client_max_body_size 6m`) |
| Security headers | Helmet with CSP configured for SPA; `img-src` allows R2 domain for presigned image URLs |
| Rate limiting | Redis-backed per-IP: 1000 req/15min general, 200 req/15min on auth endpoints |
| Image storage | Presigned URLs (15-min expiry), never public bucket access |
| Process binding | API container binds to `127.0.0.1:4000` only — Docker bypasses UFW but loopback prevents external access |
| Non-root container | Both Dockerfiles create a dedicated `appuser` (uid 1001) and switch before `CMD` |
| No DB port exposure | Postgres and Redis have no `ports:` entries — only reachable within the Docker network |

---

## API Reference

All endpoints return `{ data: ... }` on success and `{ error: { code, message } }` on failure.

### Auth

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/signup` | — | `{ email, password }` | Create account, set auth cookies |
| POST | `/api/auth/login` | — | `{ email, password }` | Login, set auth cookies |
| POST | `/api/auth/refresh` | refresh cookie | — | Rotate refresh token, issue new pair |
| POST | `/api/auth/logout` | access cookie | — | Revoke all refresh tokens, clear cookies |
| GET | `/api/auth/me` | access cookie | — | Return current user |

### Jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/jobs/upload` | Yes | Upload image (multipart/form-data, field: `image`) |
| GET | `/api/jobs` | Yes | List jobs (cursor-based pagination: `?cursor=<uuid>&limit=20`) |
| GET | `/api/jobs/:id` | Yes | Get single job with result |
| GET | `/api/jobs/:id/image-url` | Yes | Get 15-min presigned R2 URL for the image |
| POST | `/api/jobs/:id/retry` | Yes | Re-enqueue a FAILED job |
| GET | `/api/jobs/stream` | Yes | SSE stream for real-time job updates |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness — returns 200 if process is up |
| GET | `/readyz` | Readiness — pings Postgres + Redis, returns 503 if either unreachable |

### SSE Event Shapes

```json
// Job status update (fires on every status transition)
{ "type": "JOB_UPDATE", "jobId": "...", "status": "COMPLETED", "result": { ... }, "timestamp": "..." }

// Flagged content notification (fires additionally when flagged)
{ "type": "FLAGGED_NOTIFICATION", "jobId": "...", "result": { "flagged": true, "flaggedCategory": "adult" }, "timestamp": "..." }

// Heartbeat (every 20s, SSE comment — not a data event)
: heartbeat
```

### Response Shapes

```json
// POST /api/jobs/upload → 201
{ "data": { "job": { "id": "uuid", "status": "PENDING" } } }

// GET /api/jobs → 200
{ "data": { "jobs": [...], "nextCursor": "uuid", "hasMore": true } }

// GET /api/jobs/:id → 200
{
  "data": {
    "job": {
      "id": "uuid", "status": "COMPLETED", "attempts": 1,
      "createdAt": "...", "updatedAt": "...",
      "result": {
        "caption": "A dog running in a park.",
        "labels": [{ "description": "Dog", "score": 0.98 }, ...],
        "flagged": false,
        "flaggedCategory": null
      }
    }
  }
}

// Error → 4xx/5xx
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": ["email: Invalid email"] } }
```

---

## Testing

```bash
# Run the full test suite
npm test

# Run with coverage report
npm test -- --coverage
```

Test files:
- `apps/api/src/__tests__/auth.test.ts` — JWT sign/verify, alg:none rejection, expired tokens, AppError hierarchy
- `apps/worker/src/__tests__/processor.test.ts` — Vision flagged detection, safe pass-through, HF success/retry/failure

What the tests cover (per spec requirement):
- Vision: mocked response with `adult: LIKELY` → `isFlagged: true`, `flaggedCategory: 'adult'`
- Vision: safe image → `isFlagged: false`
- HF: successful caption extraction from chat completions format
- HF: 503 response with `estimated_time` → sleeps → retries → succeeds on attempt 3
- HF: 3 consecutive 503s → throws `"failed after 3 attempts"` (processor catches this and falls back to label-based caption)
- JWT: `alg:none` forged token rejected
- JWT: expired token rejected
- JWT: wrong-secret token rejected
- Error classes: correct status codes and `code` strings

---

## Scalability Notes

**How would this behave under 10× load?**

| Component | Bottleneck | Mitigation |
|-----------|-----------|------------|
| BullMQ worker | CPU-bound on sharp resize; I/O-bound on Vision/HF waits | Add more worker instances — BullMQ workers are stateless and compete on the same Redis queue. Each additional worker adds 5 more concurrent job slots. |
| Express API | Upload endpoint loads entire file into memory (multer `memoryStorage`) | Under very high upload volume, switch to streaming upload directly to R2 using presigned PUT URLs — eliminates the API container from the data path entirely. |
| PostgreSQL | Job list query on `(userId, createdAt)` — already indexed | The indexes on `@@index([userId, status])` and `@@index([userId, createdAt])` keep this fast. Cursor pagination means no `OFFSET` scans. Read replicas if query load grows. |
| Redis pub/sub | One Redis connection per SSE client | Acceptable for hundreds of concurrent users. At scale, use a shared subscriber that fan-outs to in-process EventEmitter per userId, reducing Redis connections from N-clients to 1-per-channel. |
| Cloudflare R2 | Zero bottleneck — Cloudflare's edge serves presigned image loads, not the VPS | ✓ |
| HuggingFace API | Rate-limited external dependency | The 3× retry with backoff handles transient 503s. The label-based fallback ensures completion regardless. Under high volume, a dedicated VLM endpoint (e.g., a private Replicate deployment) would replace the shared Inference Providers tier. |

**Would adding more workers help?** Yes, linearly, up to the point where either Postgres connections or Vision/HF API rate limits become the ceiling. BullMQ's Redis-backed coordination means workers can run on separate machines without any changes — just point them at the same Redis.

---

## Known Limitations

**No email notifications.** Flagged content alerts appear only as in-app SSE toasts. A production system would add an email service (e.g., Nodemailer + SendGrid/Postmark) so users are notified even when the browser is closed. The infrastructure is in place — the worker already knows `userId` at completion, and the `User` model has `email`.

**HuggingFace as external dependency.** The captioning step uses HuggingFace's Inference Providers API (Qwen3-VL-8B via Novita). This is subject to rate limits and model availability. The label-based fallback ensures jobs always complete, but the fallback caption is less rich. A production deployment would either use a private model endpoint or a more reliable API like OpenAI GPT-4o Vision.

**No job or image deletion.** Users cannot delete their jobs or the original image from R2. Adding a `DELETE /api/jobs/:id` endpoint that calls `deleteFromR2(job.r2Key)` and then removes the DB record is straightforward — the `deleteFromR2` function already exists in `storage.service.ts`.

**Single-region deployment.** Everything runs in a single VPS region. Latency for international users is unoptimized. R2 already distributes image serving globally via Cloudflare's edge. The API and worker would need geographic distribution for lower latency on processing.

**No account management.** No password reset, no email verification, no account deletion. These are standard additions to the auth flow but were out of scope for the 48-hour window.
