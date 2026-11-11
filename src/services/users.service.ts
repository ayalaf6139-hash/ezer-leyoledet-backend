import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { badRequest, conflict, HttpError, notFound } from '../utils/httpError';
import { hashPassword, verifyPassword } from '../utils/security';
import { paginate, toPaginated } from '../utils/pagination';
import { formatDateOnly } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import { createUserSchema } from '../validation/users.schemas';
import type {
  changePasswordSchema,
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
    role: query.role,
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

const FIELD_LABELS: Record<string, string> = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  phone: 'טלפון',
  email: 'אימייל',
  address: 'כתובת',
  notes: 'הערות',
};

export interface BulkFailure {
  row: number;
  email: string | null;
  reason: string;
}

/**
 * הוספת כמה מתנדבות בבת אחת. כל אחת מקבלת מייל לבחירת סיסמה.
 * שורה שגויה או אימייל שכבר רשום לא עוצרים את השאר – הם מוחזרים ברשימת failed.
 * row = מספר השורה ברשימה שנשלחה (מתחיל ב-1)
 */
export async function bulkCreateVolunteers(rows: unknown[]) {
  const created: Awaited<ReturnType<typeof createVolunteer>>[] = [];
  const failed: BulkFailure[] = [];
  const seenEmails = new Set<string>();

  for (const [index, raw] of rows.entries()) {
    const row = index + 1;
    const rawEmail =
      raw && typeof raw === 'object' && typeof (raw as { email?: unknown }).email === 'string'
        ? (raw as { email: string }).email.trim().toLowerCase()
        : null;

    const parsed = createUserSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const key = issue.path.join('.');
      const field = FIELD_LABELS[key] ?? key;
      failed.push({ row, email: rawEmail, reason: field ? `${field}: ${issue.message}` : issue.message });
      continue;
    }

    const data = { ...parsed.data, password: undefined };
    if (seenEmails.has(data.email)) {
      failed.push({ row, email: data.email, reason: 'האימייל מופיע פעמיים ברשימה' });
      continue;
    }
    seenEmails.add(data.email);

    try {
      created.push(await createVolunteer(data));
    } catch (err) {
      if (err instanceof HttpError) {
        failed.push({ row, email: data.email, reason: err.message });
        continue;
      }
      throw err;
    }
  }

  return { createdCount: created.length, failedCount: failed.length, created, failed };
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

export async function updateUser(actorId: number, id: number, data: z.infer<typeof updateUserSchema>) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('USER_NOT_FOUND', 'המתנדבת לא נמצאה');

  const newRole = data.role ?? target.role;
  const newStatus = data.status ?? target.status;

  if (data.role && data.role !== target.role) {
    if (id === actorId) {
      throw badRequest('CANNOT_CHANGE_OWN_ROLE', 'לא ניתן לשנות את ההרשאה של עצמך. מנהלת אחרת צריכה לעשות זאת');
    }
    if (data.role === 'ADMIN' && newStatus !== 'ACTIVE') {
      throw badRequest('ADMIN_MUST_BE_ACTIVE', 'יש לאשר את החשבון לפני מינוי למנהלת');
    }
    if (data.role === 'VOLUNTEER') {
      const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', id: { not: id } } });
      if (otherAdmins === 0) {
        throw badRequest('LAST_ADMIN', 'זו המנהלת היחידה. יש למנות מנהלת נוספת לפני הסרת ההרשאה');
      }
    }
  }

  if (newRole === 'ADMIN' && data.status && data.status !== 'ACTIVE') {
    throw badRequest('CANNOT_CHANGE_ADMIN_STATUS', 'לא ניתן להשבית חשבון מנהלת. יש קודם להסיר את הרשאת הניהול');
  }

  const user = await prisma.user.update({ where: { id }, data, select: adminUserSelect });

  if (target.status === 'PENDING' && user.status === 'ACTIVE') {
    sendInBackground(() => sendEmail(emails.accountApproved(user)));
  }
  return user;
}
