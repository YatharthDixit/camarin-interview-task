import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './lib/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { createGeneralLimiter, createAuthLimiter } from './middleware/rate-limit.js';
import { redisConnection } from './lib/queue.js';
import { authRouter } from './routes/auth.routes.js';
import { jobRouter } from './routes/job.routes.js';
import { healthz, readyz } from './controllers/health.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Security — first middleware, before any route
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'https://*.r2.cloudflarestorage.com', 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // CORS — same-origin in production, allow Vite dev server in development
  if (env.NODE_ENV !== 'production') {
    app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  }

  // Body parsing + cookies
  app.use(express.json());
  app.use(cookieParser());

  // Rate limiting
  const generalLimiter = createGeneralLimiter(redisConnection);
  const authLimiter = createAuthLimiter(redisConnection);

  // Health checks (no rate limit, no auth)
  app.get('/healthz', healthz);
  app.get('/readyz', readyz);

  // API routes
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/refresh', authLimiter);
  app.use('/api', generalLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/jobs', jobRouter);

  // Serve frontend in production
  if (env.NODE_ENV === 'production') {
    const webDist = path.resolve(__dirname, '../../../web/dist');
    app.use(express.static(webDist));
    // SPA fallback — any non-API route serves index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  // Error handler — must be last
  app.use(errorHandler);

  return app;
}
