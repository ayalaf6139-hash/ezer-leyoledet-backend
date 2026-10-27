import { Router } from 'express';
import * as shabbatot from '../controllers/shabbatot.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

export const shabbatotRoutes = Router();

shabbatotRoutes.use(authenticate);

// לוח השבוע – כל מחוברת (חייב להופיע לפני /:id)
shabbatotRoutes.get('/current', shabbatot.current);

// מנהלת בלבד
shabbatotRoutes.get('/', requireAdmin, shabbatot.list);
shabbatotRoutes.post('/', requireAdmin, shabbatot.create);
shabbatotRoutes.get('/:id', requireAdmin, shabbatot.getById);
shabbatotRoutes.put('/:id', requireAdmin, shabbatot.update);
shabbatotRoutes.delete('/:id', requireAdmin, shabbatot.remove);
shabbatotRoutes.post('/:id/generate-slots', requireAdmin, shabbatot.generateSlots);
shabbatotRoutes.patch('/:id/publish', requireAdmin, shabbatot.publish);
shabbatotRoutes.patch('/:id/close', requireAdmin, shabbatot.close);

export const slotsRoutes = Router();

slotsRoutes.use(authenticate, requireAdmin);

slotsRoutes.post('/', shabbatot.createSlot);
slotsRoutes.put('/:id', shabbatot.updateSlot);
slotsRoutes.delete('/:id', shabbatot.deleteSlot);
