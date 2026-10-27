import { env } from '../config/env';

// עזרי תאריכים. תאריך "בלבד" (בלי שעה) נשמר כ-Date בחצות UTC,
// ושעות המסירה והביטול מחושבות לפי שעון ישראל (כולל שעון קיץ).

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-17" → Date בחצות UTC */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Date → "2026-10-17" */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateOnly(value);
  return !Number.isNaN(date.getTime()) && formatDateOnly(date) === value;
}

export function isSaturday(date: Date): boolean {
  return date.getUTCDay() === 6;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function getZoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** ההפרש (במילישניות) בין שעון האזור ל-UTC ברגע נתון */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = getZoneParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** שעה מקומית באזור זמן (למשל 21:00 בישראל) → הרגע המדויק ב-UTC */
export function zonedDateTimeToUtc(dateOnly: Date, hour: number, minute: number, timeZone = env.TIMEZONE): Date {
  const guess = Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), hour, minute);
  const firstOffset = zoneOffsetMs(new Date(guess), timeZone);
  let result = guess - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = guess - secondOffset;
  return new Date(result);
}

/** מועד המסירה: יום חמישי שלפני השבת, 21:00 */
export function deliveryDeadlineFor(shabbatDate: Date): Date {
  return zonedDateTimeToUtc(addDays(shabbatDate, -2), 21, 0);
}

/** מועד אחרון לביטול עצמי של מתנדבת: יום רביעי שלפני השבת, 21:00 */
export function cancelDeadlineFor(shabbatDate: Date): Date {
  return zonedDateTimeToUtc(addDays(shabbatDate, -3), 21, 0);
}

/** התאריך של היום לפי שעון ישראל, כתאריך בלבד */
export function todayInZone(now = new Date(), timeZone = env.TIMEZONE): Date {
  const p = getZoneParts(now, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** תצוגה עברית לתאריך ושעה, לשימוש במיילים */
export function formatHebrewDateTime(instant: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: env.TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}

export function formatHebrewDate(dateOnly: Date): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' }).format(
    dateOnly,
  );
}
