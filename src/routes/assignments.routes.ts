import { Router } from 'express';
import * as assignments from '../controllers/assignments.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

export const assignmentsRoutes = Router();

assignmentsRoutes.use(authenticate);

assignmentsRoutes.post('/', assignments.create);
assignmentsRoutes.get('/mine', assignments.mine);
assignmentsRoutes.get('/', requireAdmin, assignments.list);
// ביטול וסימון "נמסר": מתנדבת – רק שיבוץ שלה (נבדק ב-service), מנהלת – כל שיבוץ
assignmentsRoutes.delete('/:id', assignments.cancel);
assignmentsRoutes.patch('/:id/delivered', assignments.delivered);
