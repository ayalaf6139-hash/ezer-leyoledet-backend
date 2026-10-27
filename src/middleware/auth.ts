import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { prisma } from '../db/prisma';
import { forbidden, unauthorized } from '../utils/httpError';
import { verifyAccessToken } from '../utils/security';
import type { AuthUser } from '../types/express';

/**
 * בודק את ה-Bearer Token ומצרף לבקשה את המשתמשת המחוברת (req.user).
 * בלי Token, או עם Token לא תקין / שפג תוקפו / של חשבון לא פעיל → 401.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('TOKEN_MISSING', 'נדרשת התחברות');
  }

  const token = header.slice('Bearer '.length).trim();
  let userId: number;
  try {
    userId = verifyAccessToken(token).sub;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized('TOKEN_EXPIRED', 'פג תוקף ההתחברות, יש להתחבר מחדש');
    }
    throw unauthorized('TOKEN_INVALID', 'ההתחברות אינה תקינה, יש להתחבר מחדש');
  }

  // נטען מחדש מהמסד: כך חשבון שהושבת מאבד גישה מיד, והתפקיד תמיד עדכני
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, firstName: true, lastName: true, email: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw unauthorized('ACCOUNT_NOT_ACTIVE', 'החשבון אינו פעיל, יש להתחבר מחדש');
  }

  const { status: _status, ...authUser } = user;
  req.user = authUser;
  next();
}

/** מאפשר גישה רק לתפקידים שצוינו. אחרת → 403 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized('TOKEN_MISSING', 'נדרשת התחברות');
    if (!roles.includes(req.user.role)) {
      throw forbidden('FORBIDDEN', 'אין לך הרשאה לבצע פעולה זו');
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');

/** מחזיר את המשתמשת המחוברת (לשימוש בתוך controllers אחרי authenticate) */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized('TOKEN_MISSING', 'נדרשת התחברות');
  return req.user;
}
