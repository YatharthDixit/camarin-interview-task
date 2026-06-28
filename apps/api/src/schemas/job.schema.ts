import { z } from 'zod';

export const jobIdParamSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
});

export const jobListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  search: z.string().max(200).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  flagged: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type JobIdParam = z.infer<typeof jobIdParamSchema>;
export type JobListQuery = z.infer<typeof jobListQuerySchema>;
