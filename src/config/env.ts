import 'dotenv/config';
import { z } from 'zod';

// כל הגדרות השרת נקראות ממשתני סביבה ונבדקות פעם אחת בעלייה.
// אם חסר משתנה חובה – השרת לא יעלה, ותוצג הודעה ברורה.

const booleanFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** משתנה רשות: ערך ריק (למשל EMAIL_FROM=) נחשב כלא מוגדר */
const optionalEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL חסר – כתובת החיבור למסד הנתונים'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET חייב להיות באורך 32 תווים לפחות'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // רשימת כתובות מופרדות בפסיק שמותר להן לפנות לשרת מהדפדפן, או * לכולן
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // כתובת אתר ה-React – משמשת לקישורים במיילים
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  DEFAULT_COLLECTION_POINT: z.string().min(1).default('נקודת האיסוף של הארגון'),
  TIMEZONE: z.string().default('Asia/Jerusalem'),

  // מיילים (Brevo). בלי מפתח – המיילים רק נרשמים ביומן השרת
  BREVO_API_KEY: optionalEnv(z.string()),
  EMAIL_FROM: optionalEnv(z.email('EMAIL_FROM חייב להיות כתובת אימייל')),
  EMAIL_FROM_NAME: z.string().default('עזר ליולדת'),

  // קוד סודי לתזכורות המתוזמנות (cron-job.org)
  CRON_SECRET: optionalEnv(z.string().min(16, 'CRON_SECRET חייב להיות באורך 16 תווים לפחות')),

  LOGIN_RATE_LIMIT: booleanFromEnv.default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ הגדרות סביבה לא תקינות:');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const emailEnabled = Boolean(env.BREVO_API_KEY && env.EMAIL_FROM);

export const corsOrigins =
  env.CORS_ORIGINS.trim() === '*'
    ? '*'
    : env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean);
