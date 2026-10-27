import { prisma } from '../db/prisma';
import { formatDateOnly, todayInZone } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import { serializeShabbat } from './serializers';
import { findShabbatOrThrow } from './shabbatot.service';

const SLOT_STATUS_LABELS = { OPEN: 'פנוי', TAKEN: 'תפוס', DELIVERED: 'נמסר' } as const;

async function slotsWithDetails(shabbatId: number) {
  return prisma.mealSlot.findMany({
    where: { shabbatId },
    orderBy: [{ familyId: 'asc' }, { category: 'asc' }, { id: 'asc' }],
    include: {
      family: { select: { id: true, familyName: true, peopleCount: true } },
      assignments: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          note: true,
          createdAt: true,
          product: { select: { name: true } },
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });
}

type SlotWithDetails = Awaited<ReturnType<typeof slotsWithDetails>>[number];

function summarize(slots: SlotWithDetails[]) {
  const counts = { total: slots.length, open: 0, taken: 0, delivered: 0 };
  const missing = new Map<number, { familyId: number; familyName: string; openCategories: string[] }>();
  const volunteers = new Set<number>();
  let totalPortions = 0;

  for (const slot of slots) {
    totalPortions += slot.portions;
    if (slot.status === 'OPEN') {
      counts.open += 1;
      const entry = missing.get(slot.familyId) ?? {
        familyId: slot.familyId,
        familyName: slot.family.familyName,
        openCategories: [],
      };
      entry.openCategories.push(CATEGORY_LABELS[slot.category]);
      missing.set(slot.familyId, entry);
    } else if (slot.status === 'TAKEN') {
      counts.taken += 1;
    } else {
      counts.delivered += 1;
    }
    for (const a of slot.assignments) volunteers.add(a.user.id);
  }

  return {
    slotCounts: counts,
    familiesCount: new Set(slots.map((s) => s.familyId)).size,
    volunteersCount: volunteers.size,
    totalPortions,
    familiesMissing: Array.from(missing.values()),
  };
}

/** נתוני לוח הבקרה של המנהלת */
export async function dashboard() {
  const [upcoming, pendingVolunteers, activeVolunteers, activeFamilies] = await Promise.all([
    prisma.shabbat.findFirst({ where: { shabbatDate: { gte: todayInZone() } }, orderBy: { shabbatDate: 'asc' } }),
    prisma.user.count({ where: { role: 'VOLUNTEER', status: 'PENDING' } }),
    prisma.user.count({ where: { role: 'VOLUNTEER', status: 'ACTIVE' } }),
    prisma.family.count({ where: { status: 'ACTIVE' } }),
  ]);

  return {
    upcomingShabbat: upcoming
      ? { shabbat: serializeShabbat(upcoming), ...summarize(await slotsWithDetails(upcoming.id)) }
      : null,
    pendingVolunteers,
    activeVolunteers,
    activeFamilies,
  };
}

/** סיכום שבת: משפחות, ארוחות, מתנדבות ומה חסר */
export async function weekReport(shabbatId: number) {
  const shabbat = await findShabbatOrThrow(shabbatId);
  const slots = await slotsWithDetails(shabbatId);

  const families = new Map<number, { familyId: number; familyName: string; peopleCount: number; items: unknown[] }>();
  for (const slot of slots) {
    if (!families.has(slot.familyId)) {
      families.set(slot.familyId, {
        familyId: slot.familyId,
        familyName: slot.family.familyName,
        peopleCount: slot.family.peopleCount,
        items: [],
      });
    }
    const a = slot.assignments[0];
    families.get(slot.familyId)!.items.push({
      slotId: slot.id,
      category: slot.category,
      categoryLabel: CATEGORY_LABELS[slot.category],
      portions: slot.portions,
      status: slot.status,
      productName: a?.product.name ?? null,
      volunteer: a ? { id: a.user.id, name: `${a.user.firstName} ${a.user.lastName}`, phone: a.user.phone } : null,
    });
  }

  return { shabbat: serializeShabbat(shabbat), ...summarize(slots), families: Array.from(families.values()) };
}

function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  // מניעת הזרקת נוסחאות לאקסל
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** קובץ CSV של שבת – נפתח באקסל עם עברית תקינה */
export async function weekReportCsv(shabbatId: number) {
  const shabbat = await findShabbatOrThrow(shabbatId);
  const slots = await slotsWithDetails(shabbatId);

  const header = ['משפחה', 'נפשות', 'קטגוריה', 'מנות', 'סטטוס', 'מתנדבת', 'טלפון מתנדבת', 'מוצר', 'הערה', 'נרשמה בתאריך'];
  const rows = slots.map((slot) => {
    const a = slot.assignments[0];
    return [
      slot.family.familyName,
      slot.family.peopleCount,
      CATEGORY_LABELS[slot.category],
      slot.portions,
      SLOT_STATUS_LABELS[slot.status],
      a ? `${a.user.firstName} ${a.user.lastName}` : '',
      a?.user.phone ?? '',
      a?.product.name ?? '',
      a?.note ?? '',
      a ? a.createdAt.toISOString().slice(0, 16).replace('T', ' ') : '',
    ];
  });

  // BOM בתחילת הקובץ כדי שאקסל יזהה UTF-8 ויציג עברית
  const content = '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return { filename: `shabbat-${formatDateOnly(shabbat.shabbatDate)}.csv`, content };
}
