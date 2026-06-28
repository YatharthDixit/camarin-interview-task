import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  createJob,
  findJobForUser,
  listJobsForUser,
  retryJob,
} from '@camarin/db';
import { uploadToR2, getPresignedUrl } from '../services/storage.service.js';
import { imageProcessingQueue, redisConnection } from '../lib/queue.js';
import { ok } from '../lib/response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { JobListQuery } from '../schemas/job.schema.js';
import type { ImageJobData } from '../lib/queue.js';

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('No image file provided');
  }

  const userId = req.user!.id;
  const file = req.file as Express.Multer.File & { verifiedExt?: string };
  const ext = file.verifiedExt ?? 'jpg';
  const r2Key = `${userId}/${randomUUID()}.${ext}`;

  await uploadToR2(req.file.buffer, r2Key, req.file.mimetype);

  const job = await createJob(userId, r2Key);
  logger.info({ jobId: job.id, userId }, 'Job created');

  const jobData: ImageJobData = { jobId: job.id, r2Key, userId };
  await imageProcessingQueue.add('process-image', jobData, { jobId: job.id });

  ok(res, { job: { id: job.id, status: job.status } }, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { cursor, limit, search, status, flagged } = req.query as unknown as JobListQuery;

  const filter: import('@camarin/db').JobListFilter = {};
  if (search) filter.search = search;
  if (status) filter.status = status;
  if (flagged !== undefined) filter.flagged = flagged;

  const jobs = await listJobsForUser(
    userId,
    cursor ? { id: cursor } : undefined,
    limit,
    filter,
  );

  // Cursor pagination: if we got limit+1 results, there's a next page
  const hasMore = jobs.length > limit;
  const items = hasMore ? jobs.slice(0, limit) : jobs;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  ok(res, { jobs: items, nextCursor, hasMore });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const job = await findJobForUser(req.params['id']!, req.user!.id);
  if (!job) {
    throw new NotFoundError('Job not found');
  }
  ok(res, { job });
});

export const getImageUrl = asyncHandler(async (req: Request, res: Response) => {
  const job = await findJobForUser(req.params['id']!, req.user!.id);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  const url = await getPresignedUrl(job.r2Key, 900);
  ok(res, { url });
});

export const retry = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const jobId = req.params['id']!;

  const job = await retryJob(jobId, userId);
  if (!job) {
    throw new NotFoundError('Job not found or not eligible for retry');
  }

  // Publish a JOB_UPDATE event immediately so any connected SSE clients
  // see PENDING status right away — before the worker even picks it up.
  try {
    const channel = `user:${userId}:jobs`;
    const event = JSON.stringify({
      type: 'JOB_UPDATE',
      jobId: job.id,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
    });
    await redisConnection.publish(channel, event);
  } catch (err) {
    logger.warn({ err, jobId }, 'Failed to publish PENDING SSE event on retry (non-fatal)');
  }

  // Re-enqueue with a fresh BullMQ job ID — the old failed BullMQ job
  // persists in Redis (removeOnFail: false) so reusing job.id would conflict.
  const jobData: ImageJobData = { jobId: job.id, r2Key: job.r2Key, userId };
  await imageProcessingQueue.add('process-image', jobData, {
    jobId: `${job.id}:${randomUUID()}`,
  });

  ok(res, { job: { id: job.id, status: job.status } });
});
