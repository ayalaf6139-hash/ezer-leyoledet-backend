import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authRoutes } from './auth.routes';
import { usersRoutes } from './users.routes';
import { familiesRoutes } from './families.routes';
import { productsRoutes } from './products.routes';
import { shabbatotRoutes, slotsRoutes } from './shabbatot.routes';
import { assignmentsRoutes } from './assignments.routes';
import { jobsRoutes, reportsRoutes } from './reports.routes';

export const apiRoutes = Router();

/** בדיקת בריאות: השרת פועל ומסד הנתונים זמין */
apiRoutes.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable', time: new Date().toISOString() });
  }
});

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', usersRoutes);
apiRoutes.use('/families', familiesRoutes);
apiRoutes.use('/products', productsRoutes);
apiRoutes.use('/shabbatot', shabbatotRoutes);
apiRoutes.use('/slots', slotsRoutes);
apiRoutes.use('/assignments', assignmentsRoutes);
apiRoutes.use('/reports', reportsRoutes);
apiRoutes.use('/jobs', jobsRoutes);
