import { Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { env } from './env.js';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

export const imageProcessingQueue = new Queue('image-processing', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
});

export interface ImageJobData {
  jobId: string;
  r2Key: string;
  userId: string;
}
