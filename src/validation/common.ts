import { z } from 'zod';
import { isValidDateOnly } from '../utils/dates';

// הודעות שגיאה בעברית לכל בדיקות Zod שאין להן הודעה מותאמת
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        return issue.input === undefined || issue.input === null ? 'שדה חובה' : 'סוג הערך אינו תקין';
      case 'too_small':
        if (issue.origin === 'string') return `נדרשים לפחות ${issue.minimum} תווים`;
        if (issue.origin === 'array') return `יש לבחור לפחות ${issue.minimum}`;
        return `הערך המינימלי הוא ${issue.minimum}`;
      case 'too_big':
        if (issue.origin === 'string') return `מותר עד ${issue.maximum} תווים`;
        return `הערך המקסימלי הוא ${issue.maximum}`;
      case 'invalid_format':
        return issue.format === 'email' ? 'כתובת אימייל אינה תקינה' : 'הפורמט אינו תקין';
      case 'invalid_value':
        return `ערך לא חוקי. ערכים אפשריים: ${issue.values.join(', ')}`;
      case 'unrecognized_keys':
        return `שדות לא מוכרים: ${issue.keys.join(', ')}`;
      default:
        return undefined;
    }
  },
});

export const CATEGORIES = ['MAIN', 'SALAD', 'DESSERT', 'OTHER'] as const;

export const idParam = z.object({ id: z.coerce.number().int().positive('מזהה לא תקין') });

/** טקסט חובה: מסיר רווחים מיותרים */
export const requiredText = (min: number, max: number) => z.string().trim().min(min).max(max);

/** טקסט רשות: מחרוזת ריקה הופכת ל-null */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('כתובת אימייל אינה תקינה').max(254));

/** טלפון ישראלי: 050-1234567, 0501234567, 02-6543210. נשמר בלי מקפים ורווחים */
export const phoneField = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^0\d{8,9}$/, 'מספר טלפון אינו תקין'));

export const optionalPhoneField = z
  .union([phoneField, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const passwordField = z
  .string()
  .min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים')
  .max(72, 'הסיסמה ארוכה מדי')
  .regex(/[A-Za-z֐-׿]/, 'הסיסמה חייבת להכיל לפחות אות אחת')
  .regex(/\d/, 'הסיסמה חייבת להכיל לפחות ספרה אחת');

export const dateOnlyField = z.string().refine(isValidDateOnly, 'תאריך לא תקין, יש להשתמש בפורמט YYYY-MM-DD');

export const categoryField = z.enum(CATEGORIES, 'קטגוריה לא תקינה. ערכים אפשריים: MAIN, SALAD, DESSERT, OTHER');

/** true/false ב-query string */
export const queryBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const sortOrder = z.enum(['asc', 'desc']).default('asc');
