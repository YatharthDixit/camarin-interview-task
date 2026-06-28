import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { signupSchema, loginSchema } from '../schemas/auth.schema.js';
import * as auth from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/signup', validate({ body: signupSchema }), auth.signup);
authRouter.post('/login', validate({ body: loginSchema }), auth.login);
authRouter.post('/refresh', auth.refresh);
authRouter.post('/logout', requireAuth, auth.logout);
authRouter.get('/me', requireAuth, auth.me);
