import { z } from 'zod';
import { categoryField, optionalText, queryBoolean, requiredText } from './common';

export const createProductSchema = z.strictObject({
  name: requiredText(2, 100),
  category: categoryField,
  description: optionalText(300),
});

export const updateProductSchema = z
  .strictObject({
    name: requiredText(2, 100),
    category: categoryField,
    description: optionalText(300),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'לא נשלח אף שדה לעדכון');

export const listProductsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: categoryField.optional(),
  includeInactive: queryBoolean,
});
