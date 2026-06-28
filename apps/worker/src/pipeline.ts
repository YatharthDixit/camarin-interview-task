import {
  markProcessing,
  markFlaggedCompleted,
  markCaptionedCompleted,
} from '@camarin/db';
import { downloadFromR2 } from './lib/r2.js';
import { resizeForAI } from './lib/resize.js';
import { analyzeImage } from './providers/google-vision.js';
import { captionImage } from './providers/huggingface.js';
import { fallbackCaption } from './fallback/pool.js';
import { publishJobUpdate } from './lib/publisher.js';
import type { JobUpdateEvent } from './lib/publisher.js';
import { logger } from './lib/logger.js';
import type { Logger } from 'pino';

export async function publishUpdate(userId: string, event: JobUpdateEvent): Promise<void> {
  try {
    await publishJobUpdate(userId, event);
  } catch (err) {
    logger.error({ err, event }, 'Failed to publish SSE event');
  }
}

/**
 * Runs the main AI processing pipeline for an image
 */
export async function runImagePipeline(
  jobId: string,
  r2Key: string,
  userId: string,
  log: Logger,
): Promise<void> {
  log.info({ r2Key }, 'Processing started');

  // 1. Mark as PROCESSING
  await markProcessing(jobId);
  await publishUpdate(userId, {
    type: 'JOB_UPDATE',
    jobId,
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
  });

  // 2. Download image from R2
  log.info('Downloading image from R2');
  const imageBuffer = await downloadFromR2(r2Key);

  // 3. Resize for AI APIs
  log.info('Resizing image for AI processing');
  const resizedBuffer = await resizeForAI(imageBuffer);

  // 4. Google Vision: labels + safety
  const vision = await analyzeImage(resizedBuffer, log);

  // 5. Check safety verdict
  if (vision.safeSearch.isFlagged) {
    log.warn(
      { flaggedCategory: vision.safeSearch.flaggedCategory },
      'Image flagged by SafeSearch — skipping captioning',
    );

    await markFlaggedCompleted(
      jobId,
      vision.labels,
      vision.safeSearch.flaggedCategory!,
    );

    await publishUpdate(userId, {
      type: 'JOB_UPDATE',
      jobId,
      status: 'COMPLETED',
      result: {
        labels: vision.labels,
        flagged: true,
        flaggedCategory: vision.safeSearch.flaggedCategory,
      },
      timestamp: new Date().toISOString(),
    });

    await publishUpdate(userId, {
      type: 'FLAGGED_NOTIFICATION',
      jobId,
      status: 'COMPLETED',
      result: {
        flagged: true,
        flaggedCategory: vision.safeSearch.flaggedCategory,
      },
      timestamp: new Date().toISOString(),
    });

    log.info('Job completed (flagged)');
    return;
  }

  // 6. Image is safe — proceed with captioning
  let caption: string;
  try {
    caption = await captionImage(resizedBuffer, log);
  } catch (err) {
    log.warn({ err }, 'HF captioning failed, falling back to label-based caption');
    caption = fallbackCaption(vision.labels);
  }

  // 7. Mark completed with caption + labels
  const labels = vision.labels;
  await markCaptionedCompleted(jobId, caption, labels);

  await publishUpdate(userId, {
    type: 'JOB_UPDATE',
    jobId,
    status: 'COMPLETED',
    result: {
      caption,
      labels,
      flagged: false,
    },
    timestamp: new Date().toISOString(),
  });

  log.info('Job completed (captioned)');
}
