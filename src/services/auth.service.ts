import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { conflict, badRequest, forbidden, notFound, unauthorized } from '../utils/httpError';
import { createResetToken, hashPassword, hashResetToken, signAccessToken, verifyPassword } from '../utils/security';
import type { registerSchema, resetPasswordSchema } from '../validation/auth.schemas';
import { publicUserSelect } from './serializers';
import { sendInBackground, sendMany, sendEmail } from './email/emailService';
import { emails } from './email/templates';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // שעה
export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 שעות

// hash קבוע להשוואה כשהאימייל לא קיים – כך זמן התגובה זהה ואי אפשר לגלות אילו כתובות רשומות
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export async function register(data: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) throw conflict('EMAIL_TAKEN', 'כתובת האימייל כבר רשומה במערכת');

  const { password, ...rest } = data;
  const user = await prisma.user.create({
    data: { ...rest, passwordHash: await hashPassword(password), role: 'VOLUNTEER', status: 'PENDING' },
    select: publicUserSelect,
  });

  sendInBackground(async () => {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, firstName: true, lastName: true },
    });
    await sendMany(admins.map((admin) => emails.newJoinRequest(admin, user)));
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw unauthorized('INVALID_CREDENTIALS', 'אימייל או סיסמה שגויים');
  }
  if (user.status === 'PENDING') {
    throw forbidden('ACCOUNT_PENDING', 'בקשת ההצטרפות שלך עדיין ממתינה לאישור המנהלת');
  }
  if (user.status === 'INACTIVE') {
    throw forbidden('ACCOUNT_INACTIVE', 'החשבון הושבת. לפרטים יש לפנות למנהלת');
  }

  const token = signAccessToken(user.id, user.role);
  const profile = await getProfile(user.id);
  return { token, tokenType: 'Bearer' as const, expiresIn: env.JWT_EXPIRES_IN, user: profile };
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw notFound('USER_NOT_FOUND', 'המשתמשת לא נמצאה');
  return user;
}

/** יוצר קוד איפוס חדש, שומר את ה-hash שלו ומחזיר את הקוד עצמו (לשליחה במייל בלבד) */
export async function issueResetToken(userId: number, ttlMs: number): Promise<string> {
  const { token, tokenHash } = createResetToken();
  await prisma.user.update({
    where: { id: userId },
    data: { resetTokenHash: tokenHash, resetTokenExpires: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // מייל נשלח רק לחשבון פעיל. התשובה ללקוח זהה בכל מקרה.
  if (user && user.status === 'ACTIVE') {
    const token = await issueResetToken(user.id, RESET_TOKEN_TTL_MS);
    await sendEmail(emails.passwordReset(user, token));
  }
}

export async function resetPassword(data: z.infer<typeof resetPasswordSchema>) {
  const user = await prisma.user.findUnique({ where: { resetTokenHash: hashResetToken(data.token) } });
  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw badRequest('RESET_TOKEN_INVALID', 'הקישור אינו תקין או שפג תוקפו. יש לבקש קישור חדש');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.password), resetTokenHash: null, resetTokenExpires: null },
  });
}
