import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { hashPassword, verifyPassword } from '../utils/security';
import { paginate, toPaginated } from '../utils/pagination';
import { formatDateOnly } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import type {
  changePasswordSchema,
  createUserSchema,
  listUsersQuery,
  updateMeSchema,
  updateUserSchema,
} from '../validation/users.schemas';
import { adminUserSelect, publicUserSelect } from './serializers';
import { INVITE_TOKEN_TTL_MS, issueResetToken } from './auth.service';
import { sendEmail, sendInBackground } from './email/emailService';
import { emails } from './email/templates';

/** שיבוצים שנספרים כ"פעילות" של מתנדבת – כל מה שלא בוטל */
const liveAssignments = { status: { not: 'CANCELLED' } } satisfies Prisma.AssignmentWhereInput;

export async function updateMe(userId: number, data: z.infer<typeof updateMeSchema>) {
  return prisma.user.update({ where: { id: userId }, data, select: publicUserSelect });
}

export async function changePassword(userId: number, data: z.infer<typeof changePasswordSchema>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw badRequest('WRONG_PASSWORD', 'הסיסמה הנוכחית שגויה');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(data.newPassword), resetTokenHash: null, resetTokenExpires: null },
  });
}

export async function listVolunteers(query: z.infer<typeof listUsersQuery>) {
  const where: Prisma.UserWhereInput = {
    role: 'VOLUNTEER',
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q, mode: 'insensitive' } },
            { lastName: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q.replace(/[\s-]/g, '') } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { ...adminUserSelect, _count: { select: { assignments: { where: liveAssignments } } } },
      orderBy: { [query.sortBy]: query.order },
      ...paginate(query.page, query.pageSize),
    }),
    prisma.user.count({ where }),
  ]);

  const items = rows.map(({ _count, ...user }) => ({ ...user, assignmentsCount: _count.assignments }));
  return toPaginated(items, total, query.page, query.pageSize);
}

export async function createVolunteer(data: z.infer<typeof createUserSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) throw conflict('EMAIL_TAKEN', 'כתובת האימייל כבר רשומה במערכת');

  const { password, ...rest } = data;
  // בלי סיסמה – נשמרת סיסמה אקראית שאף אחד לא יודע, והמתנדבת מקבלת קישור לבחירת סיסמה
  const initialPassword = password ?? crypto.randomBytes(24).toString('hex');
  const user = await prisma.user.create({
    data: { ...rest, passwordHash: await hashPassword(initialPassword), role: 'VOLUNTEER', status: 'ACTIVE' },
    select: adminUserSelect,
  });

  let inviteEmailSent = false;
  if (!password) {
    const token = await issueResetToken(user.id, INVITE_TOKEN_TTL_MS);
    inviteEmailSent = await sendEmail(emails.inviteSetPassword(user, token));
  }
  return { user, inviteEmailSent };
}

export async function getVolunteer(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...adminUserSelect,
      assignments: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          note: true,
          createdAt: true,
          product: { select: { id: true, name: true } },
          slot: {
            select: {
              id: true,
              category: true,
              portions: true,
              family: { select: { id: true, familyName: true } },
              shabbat: { select: { id: true, shabbatDate: true, parasha: true } },
            },
          },
        },
      },
    },
  });
  if (!user) throw notFound('USER_NOT_FOUND', 'המתנדבת לא נמצאה');

  return {
    ...user,
    assignments: user.assignments.map((a) => ({
      ...a,
      slot: {
        ...a.slot,
        categoryLabel: CATEGORY_LABELS[a.slot.category],
        shabbat: { ...a.slot.shabbat, shabbatDate: formatDateOnly(a.slot.shabbat.shabbatDate) },
      },
    })),
  };
}

export async function updateUser(id: number, data: z.infer<typeof updateUserSchema>) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('USER_NOT_FOUND', 'המתנדבת לא נמצאה');
  if (target.role === 'ADMIN' && data.status && data.status !== 'ACTIVE') {
    throw badRequest('CANNOT_CHANGE_ADMIN_STATUS', 'לא ניתן להשבית את חשבון המנהלת');
  }

  const user = await prisma.user.update({ where: { id }, data, select: adminUserSelect });

  if (target.status === 'PENDING' && user.status === 'ACTIVE') {
    sendInBackground(() => sendEmail(emails.accountApproved(user)));
  }
  return user;
}
