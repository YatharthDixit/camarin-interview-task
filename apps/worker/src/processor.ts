import { Worker, type Job } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { markFailed } from '@camarin/db';
import { env } from './lib/env.js';
import { createJobLogger, logger } from './lib/logger.js';
import { runImagePipeline, publishUpdate } from './pipeline.js';

export interface ImageJobData {
  jobId: string;
  r2Key: string;
  userId: string;
}

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

async function processImage(job: Job<ImageJobData>): Promise<void> {
  const { jobId, r2Key, userId } = job.data;
  const log = createJobLogger(jobId);
  await runImagePipeline(jobId, r2Key, userId, log);
}

// Create the BullMQ worker
export const worker = new Worker<ImageJobData>('image-processing', processImage, {
  connection: connection as any,
  concurrency: 5,
  lockDuration: 120_000, // 2 min — accounts for HF 503 retry sleeps
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 0 }, // keep all failed for debugging (removeOnFail: false equivalent)
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.data.jobId }, 'BullMQ job completed');
});

worker.on('failed', async (job, err) => {
  if (!job) return;
  const { jobId, userId } = job.data;
  logger.error({ jobId, err: err.message }, 'BullMQ job failed');

  try {
    await markFailed(jobId);
    await publishUpdate(userId, {
      type: 'JOB_UPDATE',
      jobId,
      status: 'FAILED',
      timestamp: new Date().toISOString(),
    });
  } catch (markErr) {
    logger.error({ jobId, err: markErr }, 'Failed to mark job as FAILED');
  }
});

worker.on('error', (err) => {
  logger.error({ err }, 'BullMQ worker error');
});

export { connection };

