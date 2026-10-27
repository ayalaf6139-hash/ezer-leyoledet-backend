import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { conflict, notFound } from '../utils/httpError';
import { CATEGORY_LABELS } from '../utils/labels';
import type { createSlotSchema, updateSlotSchema } from '../validation/shabbatot.schemas';
import { effectiveStatus } from './serializers';
import { findShabbatOrThrow } from './shabbatot.service';

const withLabel = <T extends { category: keyof typeof CATEGORY_LABELS }>(slot: T) => ({
  ...slot,
  categoryLabel: CATEGORY_LABELS[slot.category],
});

async function findOpenSlotForChange(id: number) {
  const slot = await prisma.mealSlot.findUnique({ where: { id }, include: { shabbat: true } });
  if (!slot) throw notFound('SLOT_NOT_FOUND', 'המשבצת לא נמצאה');
  if (effectiveStatus(slot.shabbat) === 'CLOSED') {
    throw conflict('SHABBAT_CLOSED', 'השבת הזו כבר נסגרה ולא ניתן לשנות אותה');
  }
  if (slot.status !== 'OPEN') {
    throw conflict('SLOT_NOT_OPEN', 'אפשר לשנות רק משבצת פנויה. יש לבטל קודם את השיבוץ');
  }
  return slot;
}

export async function createSlot(data: z.infer<typeof createSlotSchema>) {
  const shabbat = await findShabbatOrThrow(data.shabbatId);
  if (effectiveStatus(shabbat) === 'CLOSED') {
    throw conflict('SHABBAT_CLOSED', 'השבת הזו כבר נסגרה ולא ניתן לשנות אותה');
  }
  const family = await prisma.family.findUnique({ where: { id: data.familyId } });
  if (!family) throw notFound('FAMILY_NOT_FOUND', 'המשפחה לא נמצאה');

  const slot = await prisma.mealSlot.create({
    data: {
      shabbatId: data.shabbatId,
      familyId: data.familyId,
      category: data.category,
      portions: data.portions ?? family.peopleCount,
    },
  });
  return withLabel(slot);
}

export async function updateSlot(id: number, data: z.infer<typeof updateSlotSchema>) {
  await findOpenSlotForChange(id);
  const slot = await prisma.mealSlot.update({ where: { id }, data });
  return withLabel(slot);
}

export async function deleteSlot(id: number) {
  await findOpenSlotForChange(id);
  await prisma.mealSlot.delete({ where: { id } });
}
