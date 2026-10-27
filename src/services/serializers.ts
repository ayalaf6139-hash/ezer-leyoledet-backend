import type { Family, Prisma, Shabbat, ShabbatStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { cancelDeadlineFor, formatDateOnly } from '../utils/dates';
import { anonymousFamilyLabel, CATEGORY_LABELS } from '../utils/labels';

// הקובץ הזה קובע בדיוק אילו שדות יוצאים מהשרת.
// כך לא ייתכן שסיסמה מוצפנת או פרטי משפחה פרטיים "יברחו" בטעות לתשובה.

/** השדות של משתמשת שמותר להחזיר – בלי passwordHash ובלי קוד האיפוס */
export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  address: true,
  role: true,
  status: true,
  receiveWeeklyEmail: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** כמו publicUserSelect, וגם הערות המנהלת – רק לתשובות שהמנהלת מקבלת */
export const adminUserSelect = { ...publicUserSelect, notes: true } satisfies Prisma.UserSelect;

/** הסטטוס בפועל: שבת שפורסמה ועבר מועד המסירה שלה נחשבת סגורה */
export function effectiveStatus(shabbat: Pick<Shabbat, 'status' | 'deliveryDeadline'>, now = new Date()): ShabbatStatus {
  if (shabbat.status === 'PUBLISHED' && now >= shabbat.deliveryDeadline) return 'CLOSED';
  return shabbat.status;
}

export function serializeShabbat(shabbat: Shabbat, now = new Date()) {
  const status = effectiveStatus(shabbat, now);
  return {
    id: shabbat.id,
    shabbatDate: formatDateOnly(shabbat.shabbatDate),
    parasha: shabbat.parasha,
    deliveryDeadline: shabbat.deliveryDeadline,
    cancelDeadline: cancelDeadlineFor(shabbat.shabbatDate),
    collectionPoint: shabbat.collectionPoint,
    message: shabbat.message,
    status,
    isOpenForRegistration: status === 'PUBLISHED',
    publishedAt: shabbat.publishedAt,
    createdAt: shabbat.createdAt,
    updatedAt: shabbat.updatedAt,
  };
}

/** תצוגה ציבורית יותר של שבת – למתנדבות */
export function serializeShabbatForVolunteer(shabbat: Shabbat, now = new Date()) {
  const { createdAt: _c, updatedAt: _u, publishedAt: _p, ...rest } = serializeShabbat(shabbat, now);
  return rest;
}

export function serializeFamily(family: Family) {
  return {
    ...family,
    firstShabbat: formatDateOnly(family.firstShabbat),
    lastShabbat: formatDateOnly(family.lastShabbat),
  };
}

/** מה מתנדבת רואה על משפחה: בלי שם, כתובת, טלפון והערות מסירה */
export function serializeFamilyForVolunteer(family: Pick<Family, 'peopleCount' | 'simchaType' | 'dietaryNotes'>, label: string) {
  return {
    label,
    peopleCount: family.peopleCount,
    simchaType: family.simchaType,
    dietaryNotes: family.dietaryNotes,
  };
}

export function categoryInfo<T extends keyof typeof CATEGORY_LABELS>(category: T) {
  return { category, categoryLabel: CATEGORY_LABELS[category] };
}

/**
 * הכינויים האנונימיים ("משפחה א'") של המשפחות בשבת מסוימת.
 * הסדר קבוע (לפי מזהה המשפחה), כך שאותה משפחה מקבלת תמיד אותו כינוי באותה שבת.
 */
export async function familyLabelsForShabbat(shabbatId: number): Promise<Map<number, string>> {
  const rows = await prisma.mealSlot.findMany({
    where: { shabbatId },
    select: { familyId: true },
    distinct: ['familyId'],
    orderBy: { familyId: 'asc' },
  });
  return new Map(rows.map((row, index) => [row.familyId, anonymousFamilyLabel(index)]));
}
