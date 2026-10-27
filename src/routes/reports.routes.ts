import { Router } from 'express';
import * as reports from '../controllers/reports.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { requireCronSecret } from '../middleware/cronAuth';

export const reportsRoutes = Router();

reportsRoutes.use(authenticate, requireAdmin);

reportsRoutes.get('/dashboard', reports.dashboard);
reportsRoutes.get('/week/:id', reports.week);
reportsRoutes.get('/week/:id/export', reports.weekExport);

// משימות מתוזמנות – מוגנות בקוד סודי ולא ב-Token
export const jobsRoutes = Router();

jobsRoutes.use(requireCronSecret);

jobsRoutes.post('/thursday-reminders', reports.thursdayReminders);
jobsRoutes.post('/open-slots-report', reports.openSlotsReport);
