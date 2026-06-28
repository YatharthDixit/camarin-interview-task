import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { worker, connection } from './processor.js';
import { closePublisher } from './lib/publisher.js';

logger.info(
  { concurrency: 5, env: env.NODE_ENV },
  'Worker service starting',
);

// Graceful shutdown
const FORCE_EXIT_TIMEOUT = 30_000;

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker shutting down');

  // Force exit backstop — one stuck job can't block a deploy indefinitely
  const forceTimer = setTimeout(() => {
    logger.warn('Forced exit after timeout');
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT);
  forceTimer.unref();

  try {
    // Stop picking up new jobs, wait for active ones to finish
    await worker.close();
    logger.info('BullMQ worker closed');
  } catch (err) {
    logger.error({ err }, 'Error closing BullMQ worker');
  }

  try {
    await connection.quit();
    logger.info('Redis connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis connection');
  }

  try {
    await closePublisher();
    logger.info('Redis publisher closed');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis publisher');
  }

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Crash handlers — log and exit cleanly so `restart: unless-stopped` brings it back
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  void shutdown('unhandledRejection');
});
