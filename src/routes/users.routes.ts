import { Router } from 'express';
import * as users from '../controllers/users.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

export const usersRoutes = Router();

usersRoutes.use(authenticate);

// כל מחוברת – הפרופיל שלה בלבד (המזהה נלקח מה-Token)
usersRoutes.put('/me', users.updateMe);
usersRoutes.put('/me/password', users.changePassword);

// מנהלת בלבד
usersRoutes.get('/', requireAdmin, users.list);
usersRoutes.post('/', requireAdmin, users.create);
usersRoutes.get('/:id', requireAdmin, users.getById);
usersRoutes.patch('/:id', requireAdmin, users.update);
