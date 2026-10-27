import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { formatDateOnly, parseDateOnly } from '../utils/dates';
import { paginate, toPaginated } from '../utils/pagination';
import { CATEGORY_LABELS } from '../utils/labels';
import type { createFamilySchema, listFamiliesQuery, updateFamilySchema } from '../validation/families.schemas';
import { serializeFamily } from './serializers';

export async function listFamilies(query: z.infer<typeof listFamiliesQuery>) {
  const where: Prisma.FamilyWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { familyName: { contains: query.q, mode: 'insensitive' } },
            { simchaType: { contains: query.q, mode: 'insensitive' } },
            { address: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.family.findMany({
      where,
      orderBy: [{ [query.sortBy]: query.order }, { id: 'asc' }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.family.count({ where }),
  ]);
  return toPaginated(rows.map(serializeFamily), total, query.page, query.pageSize);
}

export async function createFamily(data: z.infer<typeof createFamilySchema>) {
  const family = await prisma.family.create({
    data: {
      ...data,
      firstShabbat: parseDateOnly(data.firstShabbat),
      lastShabbat: parseDateOnly(data.lastShabbat),
    },
  });
  return serializeFamily(family);
}

export async function getFamily(id: number) {
  const family = await prisma.family.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: [{ shabbat: { shabbatDate: 'desc' } }, { category: 'asc' }],
        take: 60,
        include: {
          shabbat: { select: { id: true, shabbatDate: true, parasha: true } },
          assignments: {
            where: { status: { not: 'CANCELLED' } },
            select: {
              id: true,
              status: true,
              product: { select: { id: true, name: true } },
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
  if (!family) throw notFound('FAMILY_NOT_FOUND', 'המשפחה לא נמצאה');

  const { slots, ...rest } = family;
  return {
    ...serializeFamily(rest),
    slots: slots.map(({ assignments, shabbat, ...slot }) => ({
      ...slot,
      categoryLabel: CATEGORY_LABELS[slot.category],
      shabbat: { ...shabbat, shabbatDate: formatDateOnly(shabbat.shabbatDate) },
      assignment: assignments[0] ?? null,
    })),
  };
}

export async function updateFamily(id: number, data: z.infer<typeof updateFamilySchema>) {
  const existing = await prisma.family.findUnique({ where: { id } });
  if (!existing) throw notFound('FAMILY_NOT_FOUND', 'המשפחה לא נמצאה');

  const firstShabbat = data.firstShabbat ? parseDateOnly(data.firstShabbat) : existing.firstShabbat;
  const lastShabbat = data.lastShabbat ? parseDateOnly(data.lastShabbat) : existing.lastShabbat;
  if (lastShabbat < firstShabbat) {
    throw badRequest('VALIDATION_ERROR', 'השבת האחרונה חייבת להיות אחרי השבת הראשונה או זהה לה', [
      { field: 'lastShabbat', message: 'השבת האחרונה חייבת להיות אחרי השבת הראשונה או זהה לה' },
    ]);
  }

  const family = await prisma.family.update({
    where: { id },
    data: { ...data, firstShabbat, lastShabbat },
  });
  return serializeFamily(family);
}

/** "מחיקה" = סיום סיוע. הרשומה וההיסטוריה נשמרות */
export async function finishFamily(id: number) {
  const existing = await prisma.family.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('FAMILY_NOT_FOUND', 'המשפחה לא נמצאה');
  const family = await prisma.family.update({ where: { id }, data: { status: 'FINISHED' } });
  return serializeFamily(family);
}
