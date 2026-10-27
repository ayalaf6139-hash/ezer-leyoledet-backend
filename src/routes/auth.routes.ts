import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { loginLimiter, sensitiveLimiter } from '../middleware/rateLimit';

export const authRoutes = Router();

authRoutes.post('/register', sensitiveLimiter, auth.register);
authRoutes.post('/login', loginLimiter, auth.login);
authRoutes.get('/me', authenticate, auth.me);
authRoutes.post('/forgot-password', sensitiveLimiter, auth.forgotPassword);
authRoutes.post('/reset-password', sensitiveLimiter, auth.resetPassword);
