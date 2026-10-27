import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const passThrough: import('express').RequestHandler = (_req, _res, next) => next();

function limiter(windowMinutes: number, limit: number) {
  if (!env.LOGIN_RATE_LIMIT) return passThrough;
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות' } },
  });
}

/** הגבלת ניסיונות התחברות – מקשה על ניחוש סיסמאות */
export const loginLimiter = limiter(15, 10);

/** הגבלה על הרשמה, שכחתי סיסמה ואיפוס – מונעת הצפת מיילים */
export const sensitiveLimiter = limiter(15, 20);
