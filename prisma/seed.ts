/**
 * נתוני הדגמה – npm run db:seed
 *
 * בפיתוח (NODE_ENV שאינו production):
 *   נוצרים מנהלת, 3 מתנדבות, 5 משפחות, 12 מוצרים, שבת מפורסמת עם שיבוצים ושבת קודמת להיסטוריה.
 *   סיסמאות לדוגמה: admin@example.com / Admin123!  ,  sara@example.com / Volunteer123!
 *
 * בפרודקשן (NODE_ENV=production):
 *   אין סיסמאות קבועות. המנהלת נוצרת רק מתוך SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD.
 *   נתוני הדגמה (משפחות, מתנדבות, שבתות) נוצרים רק אם SEED_DEMO_DATA=true,
 *   והסיסמה של המתנדבות לדוגמה נלקחת מ-SEED_DEMO_PASSWORD.
 *
 * אפשר להריץ את הסקריפט כמה פעמים: משתמשות קיימות לא משתנות, ונתוני ההדגמה נוצרים רק במסד ריק.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type Category } from '@prisma/client';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const TIMEZONE = process.env.TIMEZONE || 'Asia/Jerusalem';
const COLLECTION_POINT = process.env.DEFAULT_COLLECTION_POINT || 'רחוב הרב קוק 12, בית השם (נקודת איסוף לדוגמה)';

const DAY = 24 * 60 * 60 * 1000;

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function strongEnough(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

// ---------- תאריכים (עותק מצומצם של src/utils/dates.ts, כדי שה-seed לא יהיה תלוי בהגדרות השרת) ----------

function todayUtcDate(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function zonedToUtc(dateOnly: Date, hour: number): Date {
  const guess = Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), hour, 0);
  const offset = (instant: number) => {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(instant));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - instant;
  };
  let result = guess - offset(guess);
  result = guess - offset(result);
  return new Date(result);
}

const deliveryDeadline = (shabbat: Date) => zonedToUtc(new Date(shabbat.getTime() - 2 * DAY), 21);

/** השבת הקרובה שמועד המסירה שלה עוד לא עבר (לפחות יום קדימה) */
function upcomingShabbat(): Date {
  const today = todayUtcDate();
  let date = new Date(today.getTime() + ((6 - today.getUTCDay() + 7) % 7) * DAY);
  while (deliveryDeadline(date).getTime() < Date.now() + DAY) date = new Date(date.getTime() + 7 * DAY);
  return date;
}

/** פרשות השבוע לשנת תשפ"ז, החל משבת בראשית (10/10/2026). אין הפסקות של חגים עד פסח */
const PARASHOT_START = Date.UTC(2026, 9, 10);
const PARASHOT = [
  'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי',
  'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל', 'פקודי',
  'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע',
];

function parashaFor(date: Date): string {
  const week = Math.round((date.getTime() - PARASHOT_START) / (7 * DAY));
  return PARASHOT[week] ?? 'פרשת השבוע';
}

// ---------- נתונים ----------

const PRODUCTS: { name: string; category: Category; description?: string }[] = [
  { name: 'עוף בתנור', category: 'MAIN', description: 'עוף בתנור עם תפוחי אדמה' },
  { name: 'קציצות ברוטב', category: 'MAIN', description: 'קציצות בקר ברוטב עגבניות' },
  { name: 'צלי בקר', category: 'MAIN' },
  { name: 'שניצל', category: 'MAIN' },
  { name: 'סלט ירקות', category: 'SALAD' },
  { name: 'סלט כרוב', category: 'SALAD' },
  { name: 'חומוס ביתי', category: 'SALAD' },
  { name: 'עוגת שמרים', category: 'DESSERT' },
  { name: 'עוגת שוקולד', category: 'DESSERT' },
  { name: 'פירות חתוכים', category: 'DESSERT' },
  { name: 'חלות', category: 'OTHER', description: 'זוג חלות לשבת' },
  { name: 'קוגל', category: 'OTHER' },
];

async function upsertUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'ADMIN' | 'VOLUNTEER';
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE';
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    console.log(`   • ${data.email} כבר קיימת – לא שונתה`);
    return existing;
  }
  const { password, ...rest } = data;
  const user = await prisma.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 10) } });
  console.log(`   • נוצרה ${data.role === 'ADMIN' ? 'מנהלת' : 'מתנדבת'}: ${data.email} (${data.status})`);
  return user;
}

async function seedProducts() {
  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { name_category: { name: product.name, category: product.category } },
      update: {},
      create: product,
    });
  }
  console.log(`   • ${PRODUCTS.length} מוצרים`);
}

async function seedDemoData(volunteerPassword: string) {
  if ((await prisma.family.count()) > 0) {
    console.log('   • כבר קיימות משפחות במסד – נתוני ההדגמה לא נוצרו שוב');
    return;
  }

  const sara = await upsertUser({ email: 'sara@example.com', password: volunteerPassword, firstName: 'שרה', lastName: 'כהן', phone: '0521234567', role: 'VOLUNTEER', status: 'ACTIVE' });
  const rivka = await upsertUser({ email: 'rivka@example.com', password: volunteerPassword, firstName: 'רבקה', lastName: 'לוינשטיין', phone: '0537654321', role: 'VOLUNTEER', status: 'ACTIVE' });
  await upsertUser({ email: 'leah@example.com', password: volunteerPassword, firstName: 'לאה', lastName: 'גולדברג', phone: '0548887766', role: 'VOLUNTEER', status: 'PENDING' });

  const shabbatDate = upcomingShabbat();
  // השבת האחרונה שכבר עברה (לפני היום)
  const today = todayUtcDate();
  const pastShabbatDate = new Date(today.getTime() - ((today.getUTCDay() + 1) % 7 || 7) * DAY);
  const inWeeks = (weeks: number) => new Date(shabbatDate.getTime() + weeks * 7 * DAY);

  const families = await Promise.all(
    [
      { familyName: 'משפחת לוי', peopleCount: 7, simchaType: 'בן', address: 'רחוב השלום 12', contactPhone: '0527654321', dietaryNotes: 'ללא גלוטן לאחד הילדים', deliveryNotes: 'להשאיר ליד הדלת', firstShabbat: pastShabbatDate, lastShabbat: inWeeks(2) },
      { familyName: 'משפחת פרידמן', peopleCount: 5, simchaType: 'בת', address: 'רחוב האלה 3', contactPhone: '0581112233', dietaryNotes: null, deliveryNotes: 'קומה 2, לצלצל פעמיים', firstShabbat: pastShabbatDate, lastShabbat: inWeeks(1) },
      { familyName: 'משפחת אדלר', peopleCount: 9, simchaType: 'תאומים', address: 'רחוב הרימון 8', contactPhone: '0504445566', dietaryNotes: 'בלי אגוזים', deliveryNotes: null, firstShabbat: shabbatDate, lastShabbat: inWeeks(3) },
      { familyName: 'משפחת ברגר', peopleCount: 4, simchaType: 'בן', address: 'רחוב התאנה 21', contactPhone: '0556667788', dietaryNotes: null, deliveryNotes: null, firstShabbat: inWeeks(1), lastShabbat: inWeeks(4) },
      { familyName: 'משפחת שפירא', peopleCount: 6, simchaType: 'בת', address: 'רחוב הגפן 2', contactPhone: '0529990011', dietaryNotes: null, deliveryNotes: null, firstShabbat: new Date(pastShabbatDate.getTime() - 21 * DAY), lastShabbat: pastShabbatDate, status: 'FINISHED' as const },
    ].map((data) => prisma.family.create({ data })),
  );
  console.log(`   • ${families.length} משפחות`);

  const products = await prisma.product.findMany();
  const product = (name: string) => products.find((p) => p.name === name)!;
  const categories: Category[] = ['MAIN', 'SALAD', 'DESSERT'];

  // שבת קודמת – סגורה, עם שיבוצים שנמסרו (להיסטוריה ולדוחות)
  const past = await prisma.shabbat.create({
    data: {
      shabbatDate: pastShabbatDate,
      parasha: parashaFor(pastShabbatDate),
      collectionPoint: COLLECTION_POINT,
      deliveryDeadline: deliveryDeadline(pastShabbatDate),
      status: 'CLOSED',
      publishedAt: new Date(pastShabbatDate.getTime() - 6 * DAY),
      message: 'תודה לכל מי שהשתתפה!',
    },
  });
  for (const family of [families[0], families[1], families[4]]) {
    for (const category of categories) {
      const slot = await prisma.mealSlot.create({
        data: { shabbatId: past.id, familyId: family.id, category, portions: family.peopleCount, status: 'DELIVERED' },
      });
      const productName = { MAIN: 'עוף בתנור', SALAD: 'סלט ירקות', DESSERT: 'עוגת שמרים', OTHER: 'חלות' }[category];
      await prisma.assignment.create({
        data: {
          slotId: slot.id,
          userId: category === 'SALAD' ? rivka.id : sara.id,
          productId: product(productName).id,
          status: 'DELIVERED',
          deliveredAt: deliveryDeadline(pastShabbatDate),
        },
      });
    }
  }

  // השבת הקרובה – מפורסמת, חלק מהמשבצות תפוסות
  const current = await prisma.shabbat.create({
    data: {
      shabbatDate,
      parasha: parashaFor(shabbatDate),
      collectionPoint: COLLECTION_POINT,
      deliveryDeadline: deliveryDeadline(shabbatDate),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      message: 'שבוע טוב לכולן! השבוע שלוש משפחות שמחות מחכות לעזרתנו 💗',
    },
  });
  const activeFamilies = families.filter(
    (f) => f.status === 'ACTIVE' && f.firstShabbat <= shabbatDate && f.lastShabbat >= shabbatDate,
  );
  for (const family of activeFamilies) {
    for (const category of categories) {
      await prisma.mealSlot.create({ data: { shabbatId: current.id, familyId: family.id, category, portions: family.peopleCount } });
    }
  }
  const slots = await prisma.mealSlot.findMany({ where: { shabbatId: current.id }, orderBy: [{ familyId: 'asc' }, { category: 'asc' }] });
  const take = async (index: number, userId: number, productName: string, note?: string) => {
    await prisma.mealSlot.update({ where: { id: slots[index].id }, data: { status: 'TAKEN' } });
    await prisma.assignment.create({ data: { slotId: slots[index].id, userId, productId: product(productName).id, note } });
  };
  await take(0, sara.id, 'עוף בתנור', 'אביא בתבנית חד פעמית');
  await take(4, sara.id, 'סלט כרוב');
  await take(6, rivka.id, 'קציצות ברוטב');

  // שבת עתידית בטיוטה – לתרגול יצירת משבצות ופרסום
  const nextDate = inWeeks(1);
  await prisma.shabbat.create({
    data: { shabbatDate: nextDate, parasha: parashaFor(nextDate), collectionPoint: COLLECTION_POINT, deliveryDeadline: deliveryDeadline(nextDate), status: 'DRAFT' },
  });

  console.log(`   • 3 שבתות: קודמת (סגורה), ${shabbatDate.toISOString().slice(0, 10)} (מפורסמת), ${nextDate.toISOString().slice(0, 10)} (טיוטה)`);
}

async function main() {
  console.log(`🌱 מריץ seed (${isProduction ? 'production' : 'development'})...`);
  await seedProducts();

  if (isProduction) {
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      // ה-seed רץ בכל הפעלה של השרת בענן – בלי הגדרות מנהלת פשוט מדלגים
      console.log('   • לא הוגדרו SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD – לא נוצרה מנהלת');
      return;
    }
    if (!strongEnough(password)) fail('SEED_ADMIN_PASSWORD חייבת להכיל לפחות 8 תווים, אות וספרה');
    await upsertUser({ email, password, firstName: process.env.SEED_ADMIN_FIRST_NAME || 'מנהלת', lastName: process.env.SEED_ADMIN_LAST_NAME || 'הארגון', phone: process.env.SEED_ADMIN_PHONE || '0500000000', role: 'ADMIN', status: 'ACTIVE' });

    if (process.env.SEED_DEMO_DATA === 'true') {
      const demoPassword = process.env.SEED_DEMO_PASSWORD;
      if (!demoPassword || !strongEnough(demoPassword)) fail('כדי ליצור נתוני הדגמה בפרודקשן יש להגדיר SEED_DEMO_PASSWORD (8 תווים לפחות, אות וספרה)');
      await seedDemoData(demoPassword);
    }
  } else {
    await upsertUser({ email: 'admin@example.com', password: 'Admin123!', firstName: 'רחל', lastName: 'אברהם', phone: '0501234567', role: 'ADMIN', status: 'ACTIVE' });
    await seedDemoData('Volunteer123!');
  }
  console.log('✅ ה-seed הסתיים');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());