import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { cancelDeadlineFor, formatDateOnly, todayInZone } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import type { AuthUser } from '../types/express';
import type {
  createAssignmentSchema,
  listAssignmentsQuery,
  myAssignmentsQuery,
} from '../validation/assignments.schemas';
import {
  effectiveStatus,
  familyLabelsForShabbat,
  serializeFamilyForVolunteer,
  serializeShabbatForVolunteer,
} from './serializers';
import { sendEmail, sendInBackground, sendMany } from './email/emailService';
import { emails, type ItemLine } from './email/templates';

const detailInclude = {
  product: { select: { id: true, name: true, category: true } },
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  slot: { include: { shabbat: true, family: true } },
} satisfies Prisma.AssignmentInclude;

type AssignmentDetail = Prisma.AssignmentGetPayload<{ include: typeof detailInclude }>;

/** תצוגה למתנדבת: המשפחה מוצגת בכינוי אנונימי בלבד */
function serializeForVolunteer(a: AssignmentDetail, familyLabel: string, now = new Date()) {
  const cancelDeadline = cancelDeadlineFor(a.slot.shabbat.shabbatDate);
  return {
    id: a.id,
    status: a.status,
    note: a.note,
    createdAt: a.createdAt,
    cancelledAt: a.cancelledAt,
    deliveredAt: a.deliveredAt,
    canCancel: a.status === 'ACTIVE' && now < cancelDeadline,
    product: a.product,
    slot: {
      id: a.slot.id,
      category: a.slot.category,
      categoryLabel: CATEGORY_LABELS[a.slot.category],
      portions: a.slot.portions,
    },
    family: serializeFamilyForVolunteer(a.slot.family, familyLabel),
    shabbat: serializeShabbatForVolunteer(a.slot.shabbat, now),
  };
}

/** תצוגה למנהלת: כולל שם המשפחה ופרטי המתנדבת */
function serializeForAdmin(a: AssignmentDetail) {
  const { slot, ...rest } = a;
  return {
    ...rest,
    slot: {
      id: slot.id,
      category: slot.category,
      categoryLabel: CATEGORY_LABELS[slot.category],
      portions: slot.portions,
      status: slot.status,
    },
    family: { id: slot.family.id, familyName: slot.family.familyName, peopleCount: slot.family.peopleCount },
    shabbat: {
      id: slot.shabbat.id,
      shabbatDate: formatDateOnly(slot.shabbat.shabbatDate),
      parasha: slot.shabbat.parasha,
      status: effectiveStatus(slot.shabbat),
    },
  };
}

async function serializeFor(user: AuthUser, a: AssignmentDetail) {
  if (user.role === 'ADMIN') return serializeForAdmin(a);
  const labels = await familyLabelsForShabbat(a.slot.shabbatId);
  return serializeForVolunteer(a, labels.get(a.slot.familyId) ?? '');
}

async function itemLine(a: AssignmentDetail): Promise<ItemLine> {
  const labels = await familyLabelsForShabbat(a.slot.shabbatId);
  return {
    familyLabel: labels.get(a.slot.familyId) ?? '',
    categoryLabel: CATEGORY_LABELS[a.slot.category],
    productName: a.product.name,
    portions: a.slot.portions,
  };
}

async function findDetailOrThrow(id: number): Promise<AssignmentDetail> {
  const assignment = await prisma.assignment.findUnique({ where: { id }, include: detailInclude });
  if (!assignment) throw notFound('ASSIGNMENT_NOT_FOUND', 'השיבוץ לא נמצא');
  return assignment;
}

const slotTakenError = () => conflict('SLOT_TAKEN', 'המשבצת נתפסה, בחרי אחרת');

/** הרשמה למשבצת. מתנדבת נרשמת בעצמה; מנהלת יכולה לשבץ מתנדבת אחרת (userId) */
export async function createAssignment(actor: AuthUser, data: z.infer<typeof createAssignmentSchema>) {
  const isAdmin = actor.role === 'ADMIN';
  if (data.userId && data.userId !== actor.id && !isAdmin) {
    throw forbidden('FORBIDDEN', 'רק המנהלת יכולה לשבץ מתנדבת אחרת');
  }
  const targetUserId = data.userId ?? actor.id;
  if (targetUserId !== actor.id) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { status: true } });
    if (!target) throw notFound('USER_NOT_FOUND', 'המתנדבת לא נמצאה');
    if (target.status !== 'ACTIVE') throw badRequest('USER_NOT_ACTIVE', 'אפשר לשבץ רק מתנדבת פעילה');
  }

  const slot = await prisma.mealSlot.findUnique({ where: { id: data.slotId }, include: { shabbat: true } });
  // מתנדבת לא יכולה לדעת על קיומן של משבצות בשבת שעוד לא פורסמה
  if (!slot || (!isAdmin && slot.shabbat.status === 'DRAFT')) {
    throw notFound('SLOT_NOT_FOUND', 'המשבצת לא נמצאה');
  }
  const shabbatStatus = effectiveStatus(slot.shabbat);
  if (shabbatStatus === 'DRAFT') {
    throw conflict('SHABBAT_NOT_PUBLISHED', 'אפשר לשבץ רק אחרי שהשבת פורסמה');
  }
  if (shabbatStatus === 'CLOSED' && !isAdmin) {
    throw conflict('SHABBAT_CLOSED', 'ההרשמה לשבת הזו כבר נסגרה');
  }

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product || !product.isActive) {
    throw badRequest('PRODUCT_NOT_AVAILABLE', 'המוצר שנבחר אינו זמין', [{ field: 'productId', message: 'המוצר שנבחר אינו זמין' }]);
  }
  if (product.category !== slot.category) {
    throw badRequest('PRODUCT_CATEGORY_MISMATCH', `יש לבחור מוצר מהקטגוריה "${CATEGORY_LABELS[slot.category]}"`, [
      { field: 'productId', message: `יש לבחור מוצר מהקטגוריה "${CATEGORY_LABELS[slot.category]}"` },
    ]);
  }

  // פעולה אטומית: המשבצת עוברת ל-TAKEN רק אם היא עדיין OPEN.
  // אם שתי מתנדבות לוחצות יחד – רק אחת מצליחה. האינדקס הייחודי במסד הוא שכבת הגנה נוספת.
  let assignmentId: number;
  try {
    assignmentId = await prisma.$transaction(async (tx) => {
      const claimed = await tx.mealSlot.updateMany({
        where: { id: slot.id, status: 'OPEN' },
        data: { status: 'TAKEN' },
      });
      if (claimed.count === 0) throw slotTakenError();
      const created = await tx.assignment.create({
        data: { slotId: slot.id, userId: targetUserId, productId: product.id, note: data.note },
      });
      return created.id;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw slotTakenError();
    throw err;
  }

  const assignment = await findDetailOrThrow(assignmentId);
  sendInBackground(async () =>
    sendEmail(emails.assignmentConfirmed(assignment.user, assignment.slot.shabbat, await itemLine(assignment), assignment.note)),
  );
  return serializeFor(actor, assignment);
}

export async function listMine(user: AuthUser, query: z.infer<typeof myAssignmentsQuery>) {
  const assignments = await prisma.assignment.findMany({
    where: {
      userId: user.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.upcoming ? { slot: { shabbat: { shabbatDate: { gte: todayInZone() } } } } : {}),
    },
    include: detailInclude,
    orderBy: [{ slot: { shabbat: { shabbatDate: 'desc' } } }, { createdAt: 'desc' }],
  });

  const labelCache = new Map<number, Map<number, string>>();
  const now = new Date();
  const result = [];
  for (const a of assignments) {
    if (!labelCache.has(a.slot.shabbatId)) labelCache.set(a.slot.shabbatId, await familyLabelsForShabbat(a.slot.shabbatId));
    result.push(serializeForVolunteer(a, labelCache.get(a.slot.shabbatId)!.get(a.slot.familyId) ?? '', now));
  }
  return result;
}

export async function listAll(query: z.infer<typeof listAssignmentsQuery>) {
  const assignments = await prisma.assignment.findMany({
    where: {
      ...(query.shabbatId ? { slot: { shabbatId: query.shabbatId } } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    include: detailInclude,
    orderBy: { createdAt: 'desc' },
  });
  return assignments.map(serializeForAdmin);
}

/** ביטול שיבוץ – המשבצת חוזרת להיות פנויה. השיבוץ עצמו נשמר בסטטוס CANCELLED */
export async function cancelAssignment(actor: AuthUser, id: number) {
  const assignment = await findDetailOrThrow(id);
  const isAdmin = actor.role === 'ADMIN';
  if (!isAdmin && assignment.userId !== actor.id) {
    throw forbidden('FORBIDDEN', 'אפשר לבטל רק שיבוץ שלך');
  }
  if (assignment.status !== 'ACTIVE') {
    throw conflict('ASSIGNMENT_NOT_ACTIVE', 'אפשר לבטל רק שיבוץ פעיל');
  }
  if (!isAdmin && new Date() >= cancelDeadlineFor(assignment.slot.shabbat.shabbatDate)) {
    throw forbidden(
      'CANCEL_DEADLINE_PASSED',
      'אפשר לבטל עד יום רביעי בשעה 21:00. לביטול מאוחר יותר יש לפנות למנהלת',
    );
  }

  await prisma.$transaction([
    prisma.assignment.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } }),
    prisma.mealSlot.update({ where: { id: assignment.slotId }, data: { status: 'OPEN' } }),
  ]);

  const updated = await findDetailOrThrow(id);
  sendInBackground(async () => {
    const item = await itemLine(updated);
    if (isAdmin && updated.userId !== actor.id) {
      await sendEmail(emails.assignmentCancelledByAdmin(updated.user, updated.slot.shabbat, item));
    }
    if (!isAdmin) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { email: true, firstName: true, lastName: true },
      });
      const volunteerName = `${updated.user.firstName} ${updated.user.lastName}`;
      await sendMany(
        admins.map((admin) =>
          emails.slotFreed(admin, updated.slot.shabbat, { ...item, familyLabel: updated.slot.family.familyName }, volunteerName),
        ),
      );
    }
  });
  return serializeFor(actor, updated);
}

/** סימון "נמסר" – מתנדבת לשיבוץ שלה, מנהלת ("התקבל") לכל שיבוץ */
export async function markDelivered(actor: AuthUser, id: number) {
  const assignment = await findDetailOrThrow(id);
  if (actor.role !== 'ADMIN' && assignment.userId !== actor.id) {
    throw forbidden('FORBIDDEN', 'אפשר לסמן רק שיבוץ שלך');
  }
  if (assignment.status !== 'ACTIVE') {
    throw conflict('ASSIGNMENT_NOT_ACTIVE', 'אפשר לסמן כנמסר רק שיבוץ פעיל');
  }

  await prisma.$transaction([
    prisma.assignment.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date() } }),
    prisma.mealSlot.update({ where: { id: assignment.slotId }, data: { status: 'DELIVERED' } }),
  ]);
  return serializeFor(actor, await findDetailOrThrow(id));
}
