import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { HttpError, unauthorized } from '../utils/httpError';
import { safeEqual } from '../utils/security';

/**
 * הגנה על נתיבי המשימות המתוזמנות (/api/jobs/*).
 * הקוד הסודי נשלח בכותרת X-Cron-Secret (מומלץ) או בפרמטר ?secret= בכתובת.
 */
export function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  if (!env.CRON_SECRET) {
    throw new HttpError(503, 'CRON_NOT_CONFIGURED', 'המשימות המתוזמנות לא הוגדרו בשרת (חסר CRON_SECRET)');
  }
  const provided = req.header('x-cron-secret') ?? (typeof req.query.secret === 'string' ? req.query.secret : '');
  if (!provided || !safeEqual(provided, env.CRON_SECRET)) {
    throw unauthorized('INVALID_CRON_SECRET', 'קוד סודי שגוי');
  }
  next();
}
