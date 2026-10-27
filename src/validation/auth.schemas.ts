import { z } from 'zod';
import { emailField, optionalText, passwordField, phoneField, requiredText } from './common';

export const registerSchema = z.strictObject({
  firstName: requiredText(2, 50),
  lastName: requiredText(2, 50),
  phone: phoneField,
  email: emailField,
  password: passwordField,
  address: optionalText(200),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'יש להזין סיסמה'),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'קישור האיפוס אינו תקין'),
  password: passwordField,
});
