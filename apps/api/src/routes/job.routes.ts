import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { jobIdParamSchema, jobListQuerySchema } from '../schemas/job.schema.js';
import * as job from '../controllers/job.controller.js';
import { streamJobs } from '../controllers/sse.controller.js';

export const jobRouter = Router();

// All job routes require auth
jobRouter.use(requireAuth);

// SSE stream — must be before /:id to avoid matching 'stream' as a UUID
jobRouter.get('/stream', streamJobs);

// CRUD + actions
jobRouter.post('/upload', uploadMiddleware, job.upload);
jobRouter.get('/', validate({ query: jobListQuerySchema }), job.list);
jobRouter.get('/:id', validate({ params: jobIdParamSchema }), job.getById);
jobRouter.get('/:id/image-url', validate({ params: jobIdParamSchema }), job.getImageUrl);
jobRouter.post('/:id/retry', validate({ params: jobIdParamSchema }), job.retry);
