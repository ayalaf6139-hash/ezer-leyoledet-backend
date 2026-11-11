import { z } from 'zod';
import { paginationQuery, requiredText } from './common';

export const THANK_YOU_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;

/** טופס פתוח בדף הבית – בלי התחברות */
export const createThankYouSchema = z.strictObject({
  familyName: requiredText(2, 100),
  message: requiredText(5, 1000),
});

export const listThanksAdminQuery = z.object({
  status: z.enum(THANK_YOU_STATUSES).optional(),
  ...paginationQuery,
});

export const updateThankYouSchema = z.strictObject({
  status: z.enum(THANK_YOU_STATUSES),
});
