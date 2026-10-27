import { prisma } from '../db/prisma';
import { addDays, formatDateOnly, todayInZone } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import { familyLabelsForShabbat } from './serializers';
import { sendMany } from './email/emailService';
import { emails, type ItemLine } from './email/templates';

// משימות מתוזמנות. מופעלות מבחוץ (cron-job.org) – כך הן עובדות גם כשהשרת החינמי "נרדם".
// כל משימה רצה לכל היותר פעם אחת לכל שבת (נשמר תאריך שליחה), כך שהפעלה כפולה לא תשלח מיילים כפולים.

/** תזכורת ביום חמישי בבוקר לכל מתנדבת שמביאה משהו לשבת הקרובה */
export async function sendThursdayReminders(now = new Date()) {
  // השבת שמועד המסירה שלה הוא היום (חמישי) = השבת שחלה בעוד יומיים
  const shabbatDate = addDays(todayInZone(now), 2);
  const shabbat = await prisma.shabbat.findFirst({
    where: { shabbatDate, status: { in: ['PUBLISHED', 'CLOSED'] }, reminderSentAt: null },
  });
  if (!shabbat) {
    return { sent: 0, message: `אין שבת שמחכה לתזכורת (נבדקה השבת של ${formatDateOnly(shabbatDate)})` };
  }
  if (now >= shabbat.deliveryDeadline) {
    return { sent: 0, message: 'מועד המסירה כבר עבר – התזכורת לא נשלחה' };
  }

  // מסמנים קודם, כדי ששתי הפעלות במקביל לא ישלחו פעמיים
  const marked = await prisma.shabbat.updateMany({
    where: { id: shabbat.id, reminderSentAt: null },
    data: { reminderSentAt: now },
  });
  if (marked.count === 0) return { sent: 0, message: 'התזכורת לשבת הזו כבר נשלחה' };

  const [labels, assignments] = await Promise.all([
    familyLabelsForShabbat(shabbat.id),
    prisma.assignment.findMany({
      where: { status: 'ACTIVE', slot: { shabbatId: shabbat.id } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
        product: { select: { name: true } },
        slot: { select: { familyId: true, category: true, portions: true } },
      },
    }),
  ]);

  const byUser = new Map<number, { user: (typeof assignments)[number]['user']; items: ItemLine[] }>();
  for (const a of assignments) {
    if (a.user.status !== 'ACTIVE') continue;
    const entry = byUser.get(a.user.id) ?? { user: a.user, items: [] };
    entry.items.push({
      familyLabel: labels.get(a.slot.familyId) ?? '',
      categoryLabel: CATEGORY_LABELS[a.slot.category],
      productName: a.product.name,
      portions: a.slot.portions,
    });
    byUser.set(a.user.id, entry);
  }

  const sent = await sendMany(
    Array.from(byUser.values()).map(({ user, items }) => emails.thursdayReminder(user, shabbat, items)),
  );
  return { sent, shabbatId: shabbat.id, message: `נשלחו ${sent} תזכורות` };
}

/** דוח משבצות פתוחות למנהלת (מיועד ליום רביעי) – לשבת המפורסמת הקרובה */
export async function sendOpenSlotsReport(now = new Date()) {
  const shabbat = await prisma.shabbat.findFirst({
    where: {
      status: 'PUBLISHED',
      deliveryDeadline: { gt: now },
      openSlotsReportSentAt: null,
    },
    orderBy: { shabbatDate: 'asc' },
  });
  if (!shabbat) return { sent: 0, message: 'אין שבת מפורסמת שמחכה לדוח' };

  const marked = await prisma.shabbat.updateMany({
    where: { id: shabbat.id, openSlotsReportSentAt: null },
    data: { openSlotsReportSentAt: now },
  });
  if (marked.count === 0) return { sent: 0, message: 'הדוח לשבת הזו כבר נשלח' };

  const [openSlots, admins] = await Promise.all([
    prisma.mealSlot.findMany({
      where: { shabbatId: shabbat.id, status: 'OPEN' },
      include: { family: { select: { familyName: true } } },
      orderBy: [{ familyId: 'asc' }, { category: 'asc' }],
    }),
    prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, firstName: true, lastName: true },
    }),
  ]);

  const items = openSlots.map((slot) => ({
    familyName: slot.family.familyName,
    categoryLabel: CATEGORY_LABELS[slot.category],
    portions: slot.portions,
  }));
  const sent = await sendMany(admins.map((admin) => emails.openSlotsReport(admin, shabbat, items)));
  return { sent, shabbatId: shabbat.id, openSlots: items.length, message: `נשלח דוח עם ${items.length} משבצות פתוחות` };
}
