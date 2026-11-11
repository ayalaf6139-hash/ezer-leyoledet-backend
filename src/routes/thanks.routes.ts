import { Router } from 'express';
import * as thanks from '../controllers/thanks.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { thanksLimiter } from '../middleware/rateLimit';

export const thanksRoutes = Router();

// ציבורי – בלי התחברות
thanksRoutes.get('/', thanks.listPublic);
thanksRoutes.post('/', thanksLimiter, thanks.create);

// מנהלת בלבד
thanksRoutes.get('/admin', authenticate, requireAdmin, thanks.listAdmin);
thanksRoutes.patch('/:id', authenticate, requireAdmin, thanks.update);
thanksRoutes.delete('/:id', authenticate, requireAdmin, thanks.remove);
