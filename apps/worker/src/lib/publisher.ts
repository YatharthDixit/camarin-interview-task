import { Redis as IORedis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

const publisher = new IORedis(env.REDIS_URL);

export interface JobUpdateEvent {
  type: 'JOB_UPDATE' | 'FLAGGED_NOTIFICATION';
  jobId: string;
  status: string;
  result?: {
    caption?: string | null;
    labels?: unknown;
    flagged?: boolean;
    flaggedCategory?: string | null;
  };
  timestamp: string;
}

/**
 * Publish a job status update to the user's SSE channel.
 * The API's SSE controller subscribes to this channel.
 */
export async function publishJobUpdate(
  userId: string,
  event: JobUpdateEvent,
): Promise<void> {
  const channel = `user:${userId}:jobs`;
  try {
    await publisher.publish(channel, JSON.stringify(event));
  } catch (err) {
    logger.error({ err, channel, event }, 'Failed to publish job update');
  }
}

export async function closePublisher(): Promise<void> {
  await publisher.quit();
}
