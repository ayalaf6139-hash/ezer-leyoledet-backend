import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import type { Category, Role, UserStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { devOutbox } from '../src/services/email/emailService';
import { addDays, deliveryDeadlineFor, formatDateOnly, todayInZone } from '../src/utils/dates';

export const app = createApp();
export const api = () => supertest(app);
export { prisma, devOutbox };

export const PASSWORD = 'Password123';

/** מרוקן את כל הטבלאות לפני קובץ בדיקה */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "assignments", "meal_slots", "shabbatot", "products", "families", "users" RESTART IDENTITY CASCADE',
  );
  devOutbox.length = 0;
}

let counter = 0;

export async function createUser(options: { role?: Role; status?: UserStatus; email?: string; firstName?: string } = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      firstName: options.firstName ?? `משתמשת${counter}`,
      lastName: 'בדיקה',
      email: options.email ?? `user${counter}-${Date.now()}@test.local`,
      phone: '0521234567',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: options.role ?? 'VOLUNTEER',
      status: options.status ?? 'ACTIVE',
    },
  });
}

export async function loginAs(email: string, password = PASSWORD): Promise<string> {
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** שבת עתידית: weeksAhead=1 → השבת שבעוד 7–13 ימים (כך שכל המועדים עדיין לפנינו) */
export function futureShabbat(weeksAhead = 1): Date {
  const today = todayInZone();
  const daysToSaturday = (6 - today.getUTCDay() + 7) % 7;
  return addDays(today, daysToSaturday + 7 * weeksAhead);
}

export const dateStr = formatDateOnly;

export async function createFamily(overrides: Partial<{ familyName: string; peopleCount: number; status: 'ACTIVE' | 'FINISHED'; first: Date; last: Date }> = {}) {
  return prisma.family.create({
    data: {
      familyName: overrides.familyName ?? 'משפחת בדיקה',
      peopleCount: overrides.peopleCount ?? 6,
      simchaType: 'בן',
      address: 'רחוב סודי 1',
      contactPhone: '0509999999',
      deliveryNotes: 'הערת מסירה פרטית',
      dietaryNotes: 'ללא גלוטן',
      firstShabbat: overrides.first ?? futureShabbat(0),
      lastShabbat: overrides.last ?? futureShabbat(5),
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export async function createProduct(name: string, category: Category, isActive = true) {
  return prisma.product.create({ data: { name, category, isActive } });
}

export async function createPublishedShabbat(shabbatDate = futureShabbat(1)) {
  return prisma.shabbat.create({
    data: {
      shabbatDate,
      parasha: 'בדיקה',
      collectionPoint: 'נקודת איסוף',
      deliveryDeadline: deliveryDeadlineFor(shabbatDate),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
}

/** מחכה עד שתנאי מתקיים (למשל עד שמייל ברקע נשלח) */
export async function waitFor(condition: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
