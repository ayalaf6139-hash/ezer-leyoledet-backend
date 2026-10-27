import { Prisma } from '@prisma/client';
import type { Category, Shabbat } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { deliveryDeadlineFor, formatHebrewDate, formatHebrewDateTime, isSaturday, parseDateOnly, todayInZone } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import type {
  createShabbatSchema,
  currentBoardQuery,
  generateSlotsSchema,
  listShabbatotQuery,
  updateShabbatSchema,
} from '../validation/shabbatot.schemas';
import {
  effectiveStatus,
  familyLabelsForShabbat,
  serializeFamily,
  serializeFamilyForVolunteer,
  serializeShabbat,
  serializeShabbatForVolunteer,
} from './serializers';
import { sendInBackground, sendMany } from './email/emailService';
import { emails } from './email/templates';

type SlotCounts = { total: number; open: number; taken: number; delivered: number };

function countSlots(slots: { status: string }[]): SlotCounts {
  return {
    total: slots.length,
    open: slots.filter((s) => s.status === 'OPEN').length,
    taken: slots.filter((s) => s.status === 'TAKEN').length,
    delivered: slots.filter((s) => s.status === 'DELIVERED').length,
  };
}

export async function findShabbatOrThrow(id: number): Promise<Shabbat> {
  const shabbat = await prisma.shabbat.findUnique({ where: { id } });
  if (!shabbat) throw notFound('SHABBAT_NOT_FOUND', 'השבת לא נמצאה');
  return shabbat;
}

function assertNotClosed(shabbat: Shabbat) {
  if (effectiveStatus(shabbat) === 'CLOSED') {
    throw conflict('SHABBAT_CLOSED', 'השבת הזו כבר נסגרה ולא ניתן לשנות אותה');
  }
}

function validateShabbatDate(value: string): Date {
  const date = parseDateOnly(value);
  if (!isSaturday(date)) {
    throw badRequest('NOT_SATURDAY', 'התאריך שנבחר אינו יום שבת', [
      { field: 'shabbatDate', message: 'התאריך שנבחר אינו יום שבת' },
    ]);
  }
  if (date < todayInZone()) {
    throw badRequest('DATE_IN_PAST', 'לא ניתן ליצור שבת בתאריך שעבר', [
      { field: 'shabbatDate', message: 'לא ניתן ליצור שבת בתאריך שעבר' },
    ]);
  }
  return date;
}

function rethrowDuplicateDate(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw conflict('SHABBAT_EXISTS', 'כבר קיימת שבת בתאריך הזה');
  }
  throw err;
}

// ---------- מנהלת ----------

export async function listShabbatot(query: z.infer<typeof listShabbatotQuery>) {
  const now = new Date();
  const rows = await prisma.shabbat.findMany({
    orderBy: { shabbatDate: 'desc' },
    include: { slots: { select: { status: true, familyId: true } } },
  });
  return rows
    .map(({ slots, ...shabbat }) => ({
      ...serializeShabbat(shabbat, now),
      familiesCount: new Set(slots.map((s) => s.familyId)).size,
      slotCounts: countSlots(slots),
    }))
    .filter((s) => !query.status || s.status === query.status);
}

export async function createShabbat(data: z.infer<typeof createShabbatSchema>) {
  const shabbatDate = validateShabbatDate(data.shabbatDate);
  const shabbat = await prisma.shabbat
    .create({
      data: {
        shabbatDate,
        parasha: data.parasha,
        message: data.message,
        collectionPoint: data.collectionPoint ?? env.DEFAULT_COLLECTION_POINT,
        deliveryDeadline: deliveryDeadlineFor(shabbatDate),
      },
    })
    .catch(rethrowDuplicateDate);
  return serializeShabbat(shabbat);
}

/** הלוח המלא של שבת – למנהלת: משפחות עם שמות, משבצות, מתנדבות ומוצרים */
export async function getShabbatBoard(id: number) {
  const shabbat = await findShabbatOrThrow(id);
  const slots = await prisma.mealSlot.findMany({
    where: { shabbatId: id },
    orderBy: [{ familyId: 'asc' }, { category: 'asc' }, { id: 'asc' }],
    include: {
      family: true,
      assignments: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          status: true,
          note: true,
          createdAt: true,
          deliveredAt: true,
          product: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        },
      },
    },
  });

  const families = new Map<number, { family: ReturnType<typeof serializeFamily>; slots: unknown[] }>();
  for (const { family, assignments, ...slot } of slots) {
    if (!families.has(family.id)) families.set(family.id, { family: serializeFamily(family), slots: [] });
    families.get(family.id)!.slots.push({
      ...slot,
      categoryLabel: CATEGORY_LABELS[slot.category],
      assignment: assignments[0] ?? null,
    });
  }

  return {
    shabbat: serializeShabbat(shabbat),
    slotCounts: countSlots(slots),
    families: Array.from(families.values()).map(({ family, slots: familySlots }) => ({ ...family, slots: familySlots })),
    distributionListMessage: shabbat.status === 'DRAFT' ? null : await buildDistributionListMessage(shabbat),
  };
}

export async function updateShabbat(id: number, data: z.infer<typeof updateShabbatSchema>) {
  const shabbat = await findShabbatOrThrow(id);
  assertNotClosed(shabbat);

  const changes: Prisma.ShabbatUpdateInput = {
    parasha: data.parasha,
    collectionPoint: data.collectionPoint,
    message: data.message,
  };
  if (data.shabbatDate) {
    if (shabbat.status !== 'DRAFT') {
      throw conflict('SHABBAT_NOT_DRAFT', 'אפשר לשנות את תאריך השבת רק לפני הפרסום');
    }
    const shabbatDate = validateShabbatDate(data.shabbatDate);
    changes.shabbatDate = shabbatDate;
    changes.deliveryDeadline = deliveryDeadlineFor(shabbatDate);
  }

  const updated = await prisma.shabbat.update({ where: { id }, data: changes }).catch(rethrowDuplicateDate);
  return serializeShabbat(updated);
}

export async function deleteShabbat(id: number) {
  const shabbat = await findShabbatOrThrow(id);
  if (shabbat.status !== 'DRAFT') {
    throw conflict('SHABBAT_NOT_DRAFT', 'אפשר למחוק רק שבת שעדיין לא פורסמה');
  }
  await prisma.shabbat.delete({ where: { id } });
}

/** יצירת משבצות לכל המשפחות הפעילות שהשבת בתוך תקופת הסיוע שלהן. משבצות קיימות לא נוצרות שוב */
export async function generateSlots(id: number, input: z.infer<typeof generateSlotsSchema>) {
  const shabbat = await findShabbatOrThrow(id);
  assertNotClosed(shabbat);

  const families = await prisma.family.findMany({
    where: {
      status: 'ACTIVE',
      firstShabbat: { lte: shabbat.shabbatDate },
      lastShabbat: { gte: shabbat.shabbatDate },
    },
    orderBy: { id: 'asc' },
  });
  const existing = await prisma.mealSlot.findMany({
    where: { shabbatId: id },
    select: { familyId: true, category: true },
  });
  const existingKeys = new Set(existing.map((s) => `${s.familyId}:${s.category}`));

  const toCreate: Prisma.MealSlotCreateManyInput[] = [];
  for (const family of families) {
    for (const category of input.categories as Category[]) {
      if (!existingKeys.has(`${family.id}:${category}`)) {
        toCreate.push({ shabbatId: id, familyId: family.id, category, portions: family.peopleCount });
      }
    }
  }
  if (toCreate.length) await prisma.mealSlot.createMany({ data: toCreate });

  return {
    familiesCount: families.length,
    created: toCreate.length,
    skipped: families.length * input.categories.length - toCreate.length,
    board: await getShabbatBoard(id),
  };
}

/** הודעה קצרה להעתקה לרשימת התפוצה של הקהילה */
async function buildDistributionListMessage(shabbat: Shabbat): Promise<string> {
  const families = await familySummaries(shabbat.id);
  const lines = [
    `🍲 עזר ליולדת – שבת פרשת ${shabbat.parasha} (${formatHebrewDate(shabbat.shabbatDate)})`,
    '',
    `השבוע ${families.length} משפחות שמחות מחכות לארוחות שבת:`,
    ...families.map((line) => `• ${line}`),
    '',
    `מסירה לנקודת האיסוף (${shabbat.collectionPoint}) עד ${formatHebrewDateTime(shabbat.deliveryDeadline)}.`,
    `להרשמה ולבחירת מאכל: ${env.CLIENT_URL}`,
  ];
  if (shabbat.message) lines.splice(1, 0, shabbat.message);
  return lines.join('\n');
}

/** שורת סיכום אנונימית לכל משפחה: "משפחה א' – בן, 7 נפשות" */
async function familySummaries(shabbatId: number): Promise<string[]> {
  const labels = await familyLabelsForShabbat(shabbatId);
  const families = await prisma.family.findMany({
    where: { id: { in: Array.from(labels.keys()) } },
    select: { id: true, simchaType: true, peopleCount: true },
    orderBy: { id: 'asc' },
  });
  return families.map((f) => `${labels.get(f.id)} – ${f.simchaType}, ${f.peopleCount} נפשות`);
}

export async function publishShabbat(id: number) {
  const shabbat = await findShabbatOrThrow(id);
  if (shabbat.status !== 'DRAFT') throw conflict('ALREADY_PUBLISHED', 'השבת הזו כבר פורסמה');
  if (shabbat.deliveryDeadline <= new Date()) {
    throw conflict('DEADLINE_PASSED', 'מועד המסירה של השבת הזו כבר עבר');
  }
  const slotsCount = await prisma.mealSlot.count({ where: { shabbatId: id } });
  if (slotsCount === 0) throw conflict('NO_SLOTS', 'אי אפשר לפרסם שבת בלי משבצות. יש ליצור משבצות קודם');

  const published = await prisma.shabbat.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  const recipients = await prisma.user.findMany({
    where: { role: 'VOLUNTEER', status: 'ACTIVE', receiveWeeklyEmail: true },
    select: { email: true, firstName: true, lastName: true },
  });
  const summary = await familySummaries(id);
  sendInBackground(() => sendMany(recipients.map((user) => emails.weekPublished(user, published, summary))));

  return {
    shabbat: serializeShabbat(published),
    distributionListMessage: await buildDistributionListMessage(published),
    emailsQueued: recipients.length,
  };
}

export async function closeShabbat(id: number) {
  const shabbat = await findShabbatOrThrow(id);
  if (shabbat.status === 'DRAFT') throw conflict('SHABBAT_NOT_PUBLISHED', 'אי אפשר לסגור שבת שעוד לא פורסמה');
  if (shabbat.status === 'CLOSED') throw conflict('SHABBAT_CLOSED', 'השבת הזו כבר סגורה');
  const closed = await prisma.shabbat.update({ where: { id }, data: { status: 'CLOSED' } });
  return serializeShabbat(closed);
}

// ---------- לוח השבוע (כל מחוברת) ----------

/**
 * השבת המפורסמת הקרובה, עם כל המשבצות – בלי פרטים פרטיים של המשפחות.
 * מוצגת עד סוף יום השבת עצמו (גם אחרי שנסגרה ההרשמה), כדי שהמתנדבות יראו מה נבחר.
 */
export async function getCurrentBoard(userId: number, query: z.infer<typeof currentBoardQuery>) {
  const shabbat = await prisma.shabbat.findFirst({
    where: { status: { in: ['PUBLISHED', 'CLOSED'] }, shabbatDate: { gte: todayInZone() } },
    orderBy: { shabbatDate: 'asc' },
  });
  if (!shabbat) return { shabbat: null, slotCounts: null, families: [] };

  const [labels, slots] = await Promise.all([
    familyLabelsForShabbat(shabbat.id),
    prisma.mealSlot.findMany({
      where: { shabbatId: shabbat.id },
      orderBy: [{ familyId: 'asc' }, { category: 'asc' }, { id: 'asc' }],
      include: {
        family: { select: { id: true, peopleCount: true, simchaType: true, dietaryNotes: true } },
        assignments: {
          where: { status: { not: 'CANCELLED' } },
          select: { userId: true, product: { select: { name: true } } },
        },
      },
    }),
  ]);

  const families = new Map<number, { family: ReturnType<typeof serializeFamilyForVolunteer>; slots: unknown[] }>();
  for (const slot of slots) {
    if (query.category && slot.category !== query.category) continue;
    if (query.onlyOpen && slot.status !== 'OPEN') continue;
    const label = labels.get(slot.familyId) as string;
    if (!families.has(slot.familyId)) {
      families.set(slot.familyId, { family: serializeFamilyForVolunteer(slot.family, label), slots: [] });
    }
    const assignment = slot.assignments[0];
    families.get(slot.familyId)!.slots.push({
      id: slot.id,
      category: slot.category,
      categoryLabel: CATEGORY_LABELS[slot.category],
      portions: slot.portions,
      status: slot.status,
      productName: assignment?.product.name ?? null,
      isMine: assignment?.userId === userId,
    });
  }

  return {
    shabbat: serializeShabbatForVolunteer(shabbat),
    slotCounts: countSlots(slots),
    families: Array.from(families.values()).map(({ family, slots: familySlots }) => ({ ...family, slots: familySlots })),
  };
}
