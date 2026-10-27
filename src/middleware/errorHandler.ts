import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError';
import { isProduction } from '../config/env';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function send(res: Response, status: number, body: ErrorBody) {
  res.status(status).json(body);
}

/** נתיב שלא קיים → 404 */
export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, { error: { code: 'ROUTE_NOT_FOUND', message: `הנתיב ${req.method} ${req.path} לא קיים` } });
}

/** מטפל מרכזי בשגיאות – כל שגיאה בשרת מגיעה לכאן */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return send(res, err.status, {
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.') || null,
      message: issue.message,
    }));
    return send(res, 400, {
      error: { code: 'VALIDATION_ERROR', message: 'חלק מהנתונים שנשלחו אינם תקינים', details },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return send(res, 409, { error: { code: 'DUPLICATE', message: 'רשומה עם פרטים אלה כבר קיימת' } });
    }
    if (err.code === 'P2025') {
      return send(res, 404, { error: { code: 'NOT_FOUND', message: 'הרשומה לא נמצאה' } });
    }
    if (err.code === 'P2003') {
      return send(res, 409, {
        error: { code: 'IN_USE', message: 'לא ניתן לבצע את הפעולה כי הרשומה מקושרת לרשומות אחרות' },
      });
    }
  }

  // שגיאות של express.json: JSON לא תקין או גוף גדול מדי
  const bodyError = err as { type?: string };
  if (bodyError?.type === 'entity.parse.failed') {
    return send(res, 400, { error: { code: 'INVALID_JSON', message: 'גוף הבקשה אינו JSON תקין' } });
  }
  if (bodyError?.type === 'entity.too.large') {
    return send(res, 413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'גוף הבקשה גדול מדי' } });
  }

  console.error('Unhandled error:', err);
  return send(res, 500, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'אירעה שגיאה בשרת, נסי שוב מאוחר יותר',
      ...(!isProduction && err instanceof Error ? { details: err.message } : {}),
    },
  });
}
