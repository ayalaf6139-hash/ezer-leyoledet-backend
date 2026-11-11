import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { notFound } from '../utils/httpError';
import { paginate, toPaginated } from '../utils/pagination';
import type { createThankYouSchema, listThanksAdminQuery, updateThankYouSchema } from '../validation/thanks.schemas';
import { sendInBackground, sendMany } from './email/emailService';
import { emails } from './email/templates';

/** כמה תודות מאושרות מוצגות בדף הבית */
const PUBLIC_LIMIT = 50;

const publicSelect = { id: true, familyName: true, message: true, createdAt: true } satisfies Prisma.ThankYouSelect;

/** כל אחד יכול לכתוב תודה. היא נשמרת כ"ממתינה" ולא מוצגת עד שהמנהלת מאשרת */
export async function createThankYou(data: z.infer<typeof createThankYouSchema>) {
  const thankYou = await prisma.thankYou.create({ data, select: { ...publicSelect, status: true } });

  sendInBackground(async () => {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, firstName: true, lastName: true },
    });
    await sendMany(admins.map((admin) => emails.newThankYou(admin, thankYou)));
  });

  return thankYou;
}

/** לדף הבית: רק תודות מאושרות, החדשות ראשונות */
export async function listApprovedThanks() {
  return prisma.thankYou.findMany({
    where: { status: 'APPROVED' },
    select: publicSelect,
    orderBy: { createdAt: 'desc' },
    take: PUBLIC_LIMIT,
  });
}

export async function listThanksForAdmin(query: z.infer<typeof listThanksAdminQuery>) {
  const where: Prisma.ThankYouWhereInput = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    prisma.thankYou.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(query.page, query.pageSize) }),
    prisma.thankYou.count({ where }),
  ]);
  return toPaginated(items, total, query.page, query.pageSize);
}

export async function updateThankYou(id: number, data: z.infer<typeof updateThankYouSchema>) {
  const existing = await prisma.thankYou.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('THANK_YOU_NOT_FOUND', 'התודה לא נמצאה');
  return prisma.thankYou.update({
    where: { id },
    data: { status: data.status, reviewedAt: data.status === 'PENDING' ? null : new Date() },
  });
}

export async function deleteThankYou(id: number) {
  const existing = await prisma.thankYou.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('THANK_YOU_NOT_FOUND', 'התודה לא נמצאה');
  await prisma.thankYou.delete({ where: { id } });
}
