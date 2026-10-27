import { z } from 'zod';
import { CATEGORIES, categoryField, dateOnlyField, optionalText, queryBoolean, requiredText } from './common';

export const createShabbatSchema = z.strictObject({
  shabbatDate: dateOnlyField,
  parasha: requiredText(2, 50),
  collectionPoint: optionalText(200),
  message: optionalText(2000),
});

export const updateShabbatSchema = z
  .strictObject({
    shabbatDate: dateOnlyField,
    parasha: requiredText(2, 50),
    collectionPoint: requiredText(2, 200),
    message: optionalText(2000),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'לא נשלח אף שדה לעדכון');

export const listShabbatotQuery = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

export const currentBoardQuery = z.object({
  category: categoryField.optional(),
  onlyOpen: queryBoolean,
});

export const generateSlotsSchema = z
  .strictObject({
    categories: z.array(categoryField).min(1).max(CATEGORIES.length),
  })
  .partial()
  .optional()
  .transform((data) => ({
    categories: Array.from(new Set(data?.categories ?? (['MAIN', 'SALAD', 'DESSERT'] as const))),
  }));

export const createSlotSchema = z.strictObject({
  shabbatId: z.number().int().positive(),
  familyId: z.number().int().positive(),
  category: categoryField,
  portions: z.number().int().min(1).max(100).optional(),
});

export const updateSlotSchema = z
  .strictObject({
    category: categoryField,
    portions: z.number().int().min(1).max(100),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'לא נשלח אף שדה לעדכון');
