import { describe, expect, it } from 'vitest';
import {
  cancelDeadlineFor,
  deliveryDeadlineFor,
  isSaturday,
  isValidDateOnly,
  parseDateOnly,
  todayInZone,
  zonedDateTimeToUtc,
} from '../src/utils/dates';

describe('חישובי תאריכים ושעון ישראל', () => {
  it('מועד מסירה בשעון קיץ: חמישי 21:00 = 18:00 UTC', () => {
    // שבת 4.7.2026 → חמישי 2.7.2026, שעון קיץ (UTC+3)
    expect(deliveryDeadlineFor(parseDateOnly('2026-07-04')).toISOString()).toBe('2026-07-02T18:00:00.000Z');
  });

  it('מועד מסירה בשעון חורף: חמישי 21:00 = 19:00 UTC', () => {
    // שבת 5.12.2026 → חמישי 3.12.2026, שעון חורף (UTC+2)
    expect(deliveryDeadlineFor(parseDateOnly('2026-12-05')).toISOString()).toBe('2026-12-03T19:00:00.000Z');
  });

  it('ביטול עד רביעי 21:00', () => {
    expect(cancelDeadlineFor(parseDateOnly('2026-12-05')).toISOString()).toBe('2026-12-02T19:00:00.000Z');
  });

  it('שבוע המעבר לשעון חורף (25.10.2026) מחושב נכון', () => {
    // המסירה ביום חמישי 22.10 – עדיין שעון קיץ
    expect(deliveryDeadlineFor(parseDateOnly('2026-10-24')).toISOString()).toBe('2026-10-22T18:00:00.000Z');
    // שבוע אחרי – כבר שעון חורף
    expect(deliveryDeadlineFor(parseDateOnly('2026-10-31')).toISOString()).toBe('2026-10-29T19:00:00.000Z');
  });

  it('זיהוי יום שבת ותאריך תקין', () => {
    expect(isSaturday(parseDateOnly('2026-10-24'))).toBe(true);
    expect(isSaturday(parseDateOnly('2026-10-23'))).toBe(false);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('24/10/2026')).toBe(false);
    expect(isValidDateOnly('2026-10-24')).toBe(true);
  });

  it('התאריך של היום לפי שעון ישראל (חצות ישראל = עדיין אתמול ב-UTC)', () => {
    // 23:30 UTC ב-14.10 = 01:30 ב-15.10 בישראל
    expect(todayInZone(new Date('2026-10-14T23:30:00Z')).toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(zonedDateTimeToUtc(parseDateOnly('2026-10-15'), 0, 0).toISOString()).toBe('2026-10-14T21:00:00.000Z');
  });
});
