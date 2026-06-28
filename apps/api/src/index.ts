import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { redisConnection } from './lib/queue.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API server started');
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down API server');

  // Force exit backstop — don't let a hanging connection block a deploy
  setTimeout(() => {
    logger.warn('Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();

  // Drain in-flight HTTP requests before closing connections
  await new Promise<void>((resolve) => server.close(() => resolve()));
  logger.info('HTTP server closed');

  try {
    await redisConnection.quit();
    logger.info('Redis connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis connection');
  }

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
