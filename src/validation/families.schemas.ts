import { z } from 'zod';
import { dateOnlyField, optionalPhoneField, optionalText, paginationQuery, requiredText, sortOrder } from './common';

const familyFields = {
  familyName: requiredText(2, 100),
  contactPhone: optionalPhoneField,
  address: optionalText(200),
  peopleCount: z.number().int('מספר הנפשות חייב להיות מספר שלם').min(1).max(30),
  simchaType: requiredText(2, 50),
  firstShabbat: dateOnlyField,
  lastShabbat: dateOnlyField,
  dietaryNotes: optionalText(500),
  deliveryNotes: optionalText(500),
};

export const createFamilySchema = z
  .strictObject(familyFields)
  .refine((data) => data.lastShabbat >= data.firstShabbat, {
    message: 'השבת האחרונה חייבת להיות אחרי השבת הראשונה או זהה לה',
    path: ['lastShabbat'],
  });

export const updateFamilySchema = z
  .strictObject({ ...familyFields, status: z.enum(['ACTIVE', 'FINISHED']) })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'לא נשלח אף שדה לעדכון');

export const listFamiliesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'FINISHED']).optional(),
  sortBy: z.enum(['familyName', 'createdAt', 'firstShabbat', 'peopleCount']).default('createdAt'),
  order: sortOrder.default('desc'),
  ...paginationQuery,
});
