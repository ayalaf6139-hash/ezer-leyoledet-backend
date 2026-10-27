import { z } from 'zod';
import { optionalText } from './common';

const assignmentStatus = z.enum(['ACTIVE', 'DELIVERED', 'CANCELLED']);

export const createAssignmentSchema = z.strictObject({
  slotId: z.number().int().positive(),
  productId: z.number().int().positive(),
  note: optionalText(300),
  // רק מנהלת רשאית לשלוח – לשיבוץ ידני של מתנדבת
  userId: z.number().int().positive().optional(),
});

export const myAssignmentsQuery = z.object({
  status: assignmentStatus.optional(),
  upcoming: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const listAssignmentsQuery = z.object({
  shabbatId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  status: assignmentStatus.optional(),
});
