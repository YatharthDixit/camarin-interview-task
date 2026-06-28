import { prisma } from '../client.js';

const JOB_WITH_RESULT = {
  include: { result: true },
} as const;

/**
 * Creates a new job in the database and returns it with its empty result.
 */
export async function createJob(userId: string, r2Key: string) {
  return prisma.job.create({
    data: { userId, r2Key },
    ...JOB_WITH_RESULT,
  });
}

/**
 * Transitions a job from PENDING to PROCESSING and increments attempts.
 */
export async function markProcessing(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });
}

export type LabelRecord = { description: string; score: number };

export async function markFlaggedCompleted(
  jobId: string,
  labels: LabelRecord[],
  flaggedCategory: string,
) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      result: {
        upsert: {
          create: { labels, flagged: true, flaggedCategory },
          update: { labels, flagged: true, flaggedCategory },
        },
      },
    },
    ...JOB_WITH_RESULT,
  });
}

export async function markCaptionedCompleted(
  jobId: string,
  caption: string,
  labels: LabelRecord[],
) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      result: {
        upsert: {
          create: { caption, labels },
          update: { caption, labels },
        },
      },
    },
    ...JOB_WITH_RESULT,
  });
}

export async function markFailed(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { status: 'FAILED' },
  });
}

export async function retryJob(jobId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: jobId, userId, status: 'FAILED' },
    });
    if (!job) return null;

    // Clear out the stale result so fresh analysis starts clean
    await tx.jobResult.deleteMany({ where: { jobId } });

    return tx.job.update({
      where: { id: jobId },
      data: { status: 'PENDING' },
      include: { result: true },
    });
  });
}

export async function findJobForUser(jobId: string, userId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, userId },
    ...JOB_WITH_RESULT,
  });
}

export type JobListCursor = { id: string } | undefined;

export interface JobListFilter {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  flagged?: boolean;
  search?: string;
}

function buildJobWhere(userId: string, filter: JobListFilter) {
  const where: Record<string, unknown> = { userId };

  if (filter.status) {
    where['status'] = filter.status;
  }

  if (filter.flagged === true) {
    // Flagged only: result must exist and be flagged
    where['result'] = {
      flagged: true,
      ...(filter.search
        ? { caption: { contains: filter.search, mode: 'insensitive' } }
        : {}),
    };
  } else if (filter.flagged === false) {
    if (filter.search) {
      // Safe + search: result must be safe and caption must match
      where['result'] = {
        flagged: false,
        caption: { contains: filter.search, mode: 'insensitive' },
      };
    } else {
      // Safe: exclude any job whose result is flagged
      where['NOT'] = { result: { flagged: true } };
    }
  } else if (filter.search) {
    // No flagged filter, just search captions
    where['result'] = {
      caption: { contains: filter.search, mode: 'insensitive' },
    };
  }

  return where;
}

export async function listJobsForUser(
  userId: string,
  cursor?: JobListCursor,
  limit = 20,
  filter: JobListFilter = {},
) {
  const take = limit + 1;
  const where = buildJobWhere(userId, filter);

  return prisma.job.findMany({
    where,
    take,
    ...(cursor && { cursor: { id: cursor.id }, skip: 1 }),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...JOB_WITH_RESULT,
  });
}
