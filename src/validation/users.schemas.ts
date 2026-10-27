import { z } from 'zod';
import {
  emailField,
  optionalText,
  paginationQuery,
  passwordField,
  phoneField,
  requiredText,
  sortOrder,
} from './common';

export const updateMeSchema = z
  .strictObject({
    firstName: requiredText(2, 50),
    lastName: requiredText(2, 50),
    phone: phoneField,
    address: optionalText(200),
    receiveWeeklyEmail: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'לא נשלח אף שדה לעדכון');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'יש להזין את הסיסמה הנוכחית'),
  newPassword: passwordField,
});

export const listUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE']).optional(),
  sortBy: z.enum(['firstName', 'lastName', 'createdAt']).default('createdAt'),
  order: sortOrder.default('desc'),
  ...paginationQuery,
});

/** הוספה ישירה של מתנדבת על ידי המנהלת. בלי סיסמה – נשלח לה מייל לקביעת סיסמה */
export const createUserSchema = z.strictObject({
  firstName: requiredText(2, 50),
  lastName: requiredText(2, 50),
  phone: phoneField,
  email: emailField,
  password: passwordField.optional(),
  address: optionalText(200),
  notes: optionalText(1000),
  receiveWeeklyEmail: z.boolean().default(true),
});

export const updateUserSchema = z
  .strictObject({
    status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE']),
    firstName: requiredText(2, 50),
    lastName: requiredText(2, 50),
    phone: phoneField,
    address: optionalText(200),
    notes: optionalText(1000),
    receiveWeeklyEmail: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'לא נשלח אף שדה לעדכון');
