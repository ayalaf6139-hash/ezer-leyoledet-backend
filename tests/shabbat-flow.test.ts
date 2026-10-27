import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { addDays, cancelDeadlineFor, deliveryDeadlineFor } from '../src/utils/dates';
import {
  api,
  bearer,
  createFamily,
  createProduct,
  createUser,
  dateStr,
  devOutbox,
  futureShabbat,
  loginAs,
  prisma,
  resetDb,
  waitFor,
} from './helpers';

/**
 * התהליך השבועי המלא: יצירת שבת → משבצות → פרסום → הרשמה → ביטול / מסירה → דוחות.
 * הבדיקות בקובץ תלויות זו בזו ורצות לפי הסדר.
 */
describe('התהליך השבועי', () => {
  let adminEmail: string;
  let saraEmail: string;
  let rivkaEmail: string;
  let admin: string;
  let sara: string;
  let rivka: string;
  let rivkaId: number;
  let shabbatId: number;
  const shabbatDate = futureShabbat(1);
  const products: Record<string, number> = {};

  beforeAll(async () => {
    await resetDb();
    adminEmail = (await createUser({ role: 'ADMIN', email: 'admin@test.local' })).email;
    const s = await createUser({ email: 'sara@test.local', firstName: 'שרה' });
    const r = await createUser({ email: 'rivka@test.local', firstName: 'רבקה' });
    await createUser({ email: 'noemail@test.local' }).then((u) =>
      prisma.user.update({ where: { id: u.id }, data: { receiveWeeklyEmail: false } }),
    );
    await createUser({ email: 'pending@test.local', status: 'PENDING' });
    rivkaId = r.id;
    saraEmail = s.email;
    rivkaEmail = r.email;
    admin = await loginAs(adminEmail);
    sara = await loginAs(saraEmail);
    rivka = await loginAs(rivkaEmail);

    await createFamily({ familyName: 'משפחת לוי הסודית', peopleCount: 7 });
    await createFamily({ familyName: 'משפחת כהן הסודית', peopleCount: 4 });
    // משפחה שהסיוע שלה מתחיל רק אחרי השבת הזו – לא תקבל משבצות
    await createFamily({ familyName: 'משפחה עתידית', first: addDays(shabbatDate, 7), last: addDays(shabbatDate, 21) });
    await createFamily({ familyName: 'משפחה שסיימה', status: 'FINISHED' });

    products.chicken = (await createProduct('עוף בתנור', 'MAIN')).id;
    products.meatballs = (await createProduct('קציצות', 'MAIN')).id;
    products.salad = (await createProduct('סלט ירקות', 'SALAD')).id;
    products.cake = (await createProduct('עוגת שמרים', 'DESSERT')).id;
    products.oldCake = (await createProduct('עוגה ישנה', 'DESSERT', false)).id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('לפני שיש שבת מפורסמת – לוח השבוע ריק', async () => {
    const res = await api().get('/api/shabbatot/current').set(bearer(sara));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ shabbat: null, slotCounts: null, families: [] });
  });

  it('יצירת שבת: תאריך שאינו שבת → 400, תאריך שעבר → 400', async () => {
    const friday = await api().post('/api/shabbatot').set(bearer(admin)).send({ shabbatDate: dateStr(addDays(shabbatDate, -1)), parasha: 'נח' });
    expect(friday.status).toBe(400);
    expect(friday.body.error.code).toBe('NOT_SATURDAY');

    const past = await api().post('/api/shabbatot').set(bearer(admin)).send({ shabbatDate: dateStr(addDays(shabbatDate, -21)), parasha: 'נח' });
    expect(past.status).toBe(400);
    expect(past.body.error.code).toBe('DATE_IN_PAST');
  });

  it('יצירת שבת: מועד מסירה מחושב אוטומטית, כפילות → 409', async () => {
    const res = await api().post('/api/shabbatot').set(bearer(admin)).send({ shabbatDate: dateStr(shabbatDate), parasha: 'נח', message: 'שבוע טוב!' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.deliveryDeadline).toBe(deliveryDeadlineFor(shabbatDate).toISOString());
    expect(res.body.collectionPoint).toBeTruthy();
    shabbatId = res.body.id;

    const dup = await api().post('/api/shabbatot').set(bearer(admin)).send({ shabbatDate: dateStr(shabbatDate), parasha: 'נח' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SHABBAT_EXISTS');
  });

  it('טיוטה לא מופיעה למתנדבות, ואי אפשר לפרסם בלי משבצות', async () => {
    const board = await api().get('/api/shabbatot/current').set(bearer(sara));
    expect(board.body.shabbat).toBeNull();

    const publish = await api().patch(`/api/shabbatot/${shabbatId}/publish`).set(bearer(admin));
    expect(publish.status).toBe(409);
    expect(publish.body.error.code).toBe('NO_SLOTS');
  });

  it('יצירת משבצות אוטומטית – רק למשפחות פעילות בתקופת הסיוע, בלי כפילויות', async () => {
    const res = await api().post(`/api/shabbatot/${shabbatId}/generate-slots`).set(bearer(admin)).send();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ familiesCount: 2, created: 6, skipped: 0 });
    const names = res.body.board.families.map((f: { familyName: string }) => f.familyName);
    expect(names).toEqual(['משפחת לוי הסודית', 'משפחת כהן הסודית']);
    expect(res.body.board.families[0].slots[0].portions).toBe(7);

    const again = await api().post(`/api/shabbatot/${shabbatId}/generate-slots`).set(bearer(admin)).send({ categories: ['MAIN', 'OTHER'] });
    expect(again.body).toMatchObject({ created: 2, skipped: 2 });
  });

  it('ניהול משבצות ידני: הוספה, עריכה, מחיקה', async () => {
    const family = await prisma.family.findFirstOrThrow({ where: { familyName: 'משפחת לוי הסודית' } });
    const created = await api().post('/api/slots').set(bearer(admin)).send({ shabbatId, familyId: family.id, category: 'SALAD' });
    expect(created.status).toBe(201);
    expect(created.body.portions).toBe(7);

    const updated = await api().put(`/api/slots/${created.body.id}`).set(bearer(admin)).send({ portions: 10 });
    expect(updated.body.portions).toBe(10);

    // מוחקים את המשבצת הנוספת ואת משבצות "אחר"
    expect((await api().delete(`/api/slots/${created.body.id}`).set(bearer(admin))).status).toBe(204);
    const others = await prisma.mealSlot.findMany({ where: { shabbatId, category: 'OTHER' } });
    for (const slot of others) {
      expect((await api().delete(`/api/slots/${slot.id}`).set(bearer(admin))).status).toBe(204);
    }
    expect(await prisma.mealSlot.count({ where: { shabbatId } })).toBe(6);
  });

  it('פרסום: הודעה לרשימת התפוצה ומייל רק למתנדבות פעילות שבחרו לקבל', async () => {
    devOutbox.length = 0;
    const res = await api().patch(`/api/shabbatot/${shabbatId}/publish`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.shabbat.status).toBe('PUBLISHED');
    expect(res.body.distributionListMessage).toContain('נח');
    expect(res.body.distributionListMessage).toContain("משפחה א'");
    expect(res.body.distributionListMessage).not.toContain('הסודית');
    expect(res.body.emailsQueued).toBe(2);

    await waitFor(() => devOutbox.length >= 2);
    const recipients = devOutbox.map((m) => m.to.email).sort();
    expect(recipients).toEqual(['rivka@test.local', 'sara@test.local']);
    expect(devOutbox.every((m) => !m.html.includes('הסודית'))).toBe(true);

    const twice = await api().patch(`/api/shabbatot/${shabbatId}/publish`).set(bearer(admin));
    expect(twice.status).toBe(409);
  });

  it('אחרי פרסום – אי אפשר לשנות תאריך או למחוק את השבת', async () => {
    const date = await api().put(`/api/shabbatot/${shabbatId}`).set(bearer(admin)).send({ shabbatDate: dateStr(addDays(shabbatDate, 7)) });
    expect(date.status).toBe(409);
    const del = await api().delete(`/api/shabbatot/${shabbatId}`).set(bearer(admin));
    expect(del.status).toBe(409);
    const msg = await api().put(`/api/shabbatot/${shabbatId}`).set(bearer(admin)).send({ message: 'חסרים קינוחים!' });
    expect(msg.status).toBe(200);
    expect(msg.body.message).toBe('חסרים קינוחים!');
  });

  it('לוח השבוע למתנדבת: בלי שם, כתובת, טלפון והערות מסירה של המשפחה', async () => {
    const res = await api().get('/api/shabbatot/current').set(bearer(sara));
    expect(res.status).toBe(200);
    expect(res.body.shabbat).toMatchObject({ id: shabbatId, parasha: 'נח', isOpenForRegistration: true });
    expect(res.body.families).toHaveLength(2);
    expect(res.body.families[0]).toMatchObject({ label: "משפחה א'", peopleCount: 7, simchaType: 'בן', dietaryNotes: 'ללא גלוטן' });

    const text = JSON.stringify(res.body);
    for (const secret of ['הסודית', 'רחוב סודי', '0509999999', 'הערת מסירה פרטית', 'familyName', 'familyId']) {
      expect(text).not.toContain(secret);
    }
  });

  it('לוח השבוע: סינון לפי קטגוריה ו"רק פנויות"', async () => {
    const salads = await api().get('/api/shabbatot/current?category=SALAD').set(bearer(sara));
    const categories = salads.body.families.flatMap((f: { slots: { category: string }[] }) => f.slots.map((s) => s.category));
    expect(new Set(categories)).toEqual(new Set(['SALAD']));
    expect(categories).toHaveLength(2);
  });

  let mainSlotId: number;
  let saladSlotId: number;
  let dessertSlotId: number;
  let saraAssignmentId: number;

  it('הרשמה למשבצת: מוצר מקטגוריה אחרת → 400, מוצר מושבת → 400', async () => {
    const slots = await prisma.mealSlot.findMany({ where: { shabbatId }, orderBy: [{ familyId: 'asc' }, { category: 'asc' }] });
    mainSlotId = slots.find((s) => s.category === 'MAIN')!.id;
    saladSlotId = slots.find((s) => s.category === 'SALAD')!.id;
    dessertSlotId = slots.find((s) => s.category === 'DESSERT')!.id;

    const mismatch = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: mainSlotId, productId: products.salad });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('PRODUCT_CATEGORY_MISMATCH');

    const inactive = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: dessertSlotId, productId: products.oldCake });
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe('PRODUCT_NOT_AVAILABLE');

    const missing = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: 99999, productId: products.chicken });
    expect(missing.status).toBe(404);
  });

  it('הרשמה למשבצת מצליחה, נשלח מייל אישור, והמשבצת נסגרת לאחרות', async () => {
    devOutbox.length = 0;
    const res = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: mainSlotId, productId: products.chicken, note: 'בתבנית חד פעמית' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'ACTIVE', canCancel: true, product: { name: 'עוף בתנור' }, family: { label: "משפחה א'" } });
    expect(JSON.stringify(res.body)).not.toContain('הסודית');
    saraAssignmentId = res.body.id;
    await waitFor(() => devOutbox.some((m) => m.to.email === 'sara@test.local' && m.subject.includes('עוף בתנור')));

    const taken = await api().post('/api/assignments').set(bearer(rivka)).send({ slotId: mainSlotId, productId: products.meatballs });
    expect(taken.status).toBe(409);
    expect(taken.body.error).toEqual({ code: 'SLOT_TAKEN', message: 'המשבצת נתפסה, בחרי אחרת' });

    const board = await api().get('/api/shabbatot/current').set(bearer(rivka));
    const slot = board.body.families[0].slots.find((s: { id: number }) => s.id === mainSlotId);
    expect(slot).toMatchObject({ status: 'TAKEN', productName: 'עוף בתנור', isMine: false });
    const mine = await api().get('/api/shabbatot/current').set(bearer(sara));
    expect(mine.body.families[0].slots.find((s: { id: number }) => s.id === mainSlotId).isMine).toBe(true);
  });

  it('מניעת כפילויות: 10 בקשות במקביל לאותה משבצת – בדיוק אחת מצליחה', async () => {
    const volunteers = await Promise.all(Array.from({ length: 10 }, () => createUser()));
    const tokens = await Promise.all(volunteers.map((v) => loginAs(v.email)));
    const results = await Promise.all(
      tokens.map((t) => api().post('/api/assignments').set(bearer(t)).send({ slotId: dessertSlotId, productId: products.cake })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(await prisma.assignment.count({ where: { slotId: dessertSlotId, status: { not: 'CANCELLED' } } })).toBe(1);

    // משחררים את המשבצת להמשך הבדיקות
    const winner = await prisma.assignment.findFirstOrThrow({ where: { slotId: dessertSlotId, status: 'ACTIVE' } });
    expect((await api().delete(`/api/assignments/${winner.id}`).set(bearer(admin))).status).toBe(200);
  });

  it('מתנדבת לא יכולה לשבץ מתנדבת אחרת (userId) → 403', async () => {
    const res = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: saladSlotId, productId: products.salad, userId: rivkaId });
    expect(res.status).toBe(403);
  });

  it('מנהלת משבצת מתנדבת ידנית, ומקבלת את פרטי המשפחה המלאים', async () => {
    const res = await api().post('/api/assignments').set(bearer(admin)).send({ slotId: saladSlotId, productId: products.salad, userId: rivkaId });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(rivkaId);
    expect(res.body.family.familyName).toBe('משפחת לוי הסודית');
  });

  it('השיבוצים שלי – רק של המחוברת', async () => {
    const res = await api().get('/api/assignments/mine').set(bearer(sara));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: saraAssignmentId, shabbat: { id: shabbatId }, slot: { portions: 7 } });

    const rivkaMine = await api().get('/api/assignments/mine?status=ACTIVE').set(bearer(rivka));
    expect(rivkaMine.body.map((a: { product: { name: string } }) => a.product.name)).toEqual(['סלט ירקות']);
  });

  it('מעקב מנהלת: כל השיבוצים לשבת עם סינון', async () => {
    const all = await api().get(`/api/assignments?shabbatId=${shabbatId}`).set(bearer(admin));
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThanOrEqual(3);
    const active = await api().get(`/api/assignments?shabbatId=${shabbatId}&status=ACTIVE`).set(bearer(admin));
    expect(active.body).toHaveLength(2);
    const ofRivka = await api().get(`/api/assignments?userId=${rivkaId}`).set(bearer(admin));
    expect(ofRivka.body.every((a: { user: { id: number } }) => a.user.id === rivkaId)).toBe(true);
  });

  it('מתנדבת לא יכולה לבטל או לסמן שיבוץ של אחרת → 403', async () => {
    expect((await api().delete(`/api/assignments/${saraAssignmentId}`).set(bearer(rivka))).status).toBe(403);
    expect((await api().patch(`/api/assignments/${saraAssignmentId}/delivered`).set(bearer(rivka))).status).toBe(403);
  });

  it('ביטול עצמי לפני המועד: המשבצת חוזרת לפנויה ונשלח מייל למנהלת', async () => {
    devOutbox.length = 0;
    const res = await api().delete(`/api/assignments/${saraAssignmentId}`).set(bearer(sara));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect((await prisma.mealSlot.findUniqueOrThrow({ where: { id: mainSlotId } })).status).toBe('OPEN');
    await waitFor(() => devOutbox.some((m) => m.to.email === 'admin@test.local' && m.subject.includes('התפנתה')));

    const again = await api().delete(`/api/assignments/${saraAssignmentId}`).set(bearer(sara));
    expect(again.status).toBe(409);

    // אחרי ביטול אפשר להירשם שוב לאותה משבצת
    const retake = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: mainSlotId, productId: products.meatballs });
    expect(retake.status).toBe(201);
    saraAssignmentId = retake.body.id;
  });

  it('אחרי רביעי 21:00: מתנדבת לא יכולה לבטל (403), מנהלת כן', async () => {
    // רביעי 22:00 – אחרי מועד הביטול, לפני מועד המסירה
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(cancelDeadlineFor(shabbatDate).getTime() + 60 * 60 * 1000));
    const saraNow = await loginAs(saraEmail);
    const adminNow = await loginAs(adminEmail);

    const mine = await api().get('/api/assignments/mine').set(bearer(saraNow));
    expect(mine.body.find((a: { id: number }) => a.id === saraAssignmentId).canCancel).toBe(false);

    const late = await api().delete(`/api/assignments/${saraAssignmentId}`).set(bearer(saraNow));
    expect(late.status).toBe(403);
    expect(late.body.error.code).toBe('CANCEL_DEADLINE_PASSED');

    // עדיין אפשר להירשם (ההרשמה נסגרת רק בחמישי)
    const stillOpen = await api().get('/api/shabbatot/current').set(bearer(saraNow));
    expect(stillOpen.body.shabbat.isOpenForRegistration).toBe(true);

    devOutbox.length = 0;
    const byAdmin = await api().delete(`/api/assignments/${saraAssignmentId}`).set(bearer(adminNow));
    expect(byAdmin.status).toBe(200);
    await waitFor(() => devOutbox.some((m) => m.to.email === 'sara@test.local' && m.subject.includes('בוטל')));

    const retake = await api().post('/api/assignments').set(bearer(saraNow)).send({ slotId: mainSlotId, productId: products.chicken });
    expect(retake.status).toBe(201);
    saraAssignmentId = retake.body.id;
  });

  it('תזכורת חמישי בבוקר: נשלחת פעם אחת לכל מתנדבת משובצת', async () => {
    // חמישי 08:00 שעון ישראל = 13 שעות לפני המסירה
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(deliveryDeadlineFor(shabbatDate).getTime() - 13 * 60 * 60 * 1000));
    devOutbox.length = 0;

    const res = await api().post('/api/jobs/thursday-reminders').set('X-Cron-Secret', process.env.CRON_SECRET as string);
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(2);
    expect(devOutbox.map((m) => m.to.email).sort()).toEqual(['rivka@test.local', 'sara@test.local']);
    expect(devOutbox.every((m) => m.subject.includes('תזכורת'))).toBe(true);

    const twice = await api().post('/api/jobs/thursday-reminders').set('X-Cron-Secret', process.env.CRON_SECRET as string);
    expect(twice.body.sent).toBe(0);
  });

  it('דוח משבצות פתוחות למנהלת – נשלח פעם אחת', async () => {
    devOutbox.length = 0;
    const res = await api().post('/api/jobs/open-slots-report').set('X-Cron-Secret', process.env.CRON_SECRET as string);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sent: 1, openSlots: 4 });
    expect(devOutbox[0].to.email).toBe('admin@test.local');
    expect(devOutbox[0].html).toContain('הסודית'); // המנהלת כן רואה שמות

    const twice = await api().post('/api/jobs/open-slots-report').set('X-Cron-Secret', process.env.CRON_SECRET as string);
    expect(twice.body.sent).toBe(0);
  });

  it('סימון "נמסר" על ידי המתנדבת', async () => {
    const res = await api().patch(`/api/assignments/${saraAssignmentId}/delivered`).set(bearer(sara));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DELIVERED');
    expect((await prisma.mealSlot.findUniqueOrThrow({ where: { id: mainSlotId } })).status).toBe('DELIVERED');

    const cancelDelivered = await api().delete(`/api/assignments/${saraAssignmentId}`).set(bearer(admin));
    expect(cancelDelivered.status).toBe(409);
  });

  it('אחרי חמישי 21:00 השבת נסגרת אוטומטית: אי אפשר להירשם', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(deliveryDeadlineFor(shabbatDate).getTime() + 60 * 1000));
    const rivkaNow = await loginAs(rivkaEmail);
    const adminNow = await loginAs(adminEmail);

    const board = await api().get('/api/shabbatot/current').set(bearer(rivkaNow));
    expect(board.body.shabbat).toMatchObject({ status: 'CLOSED', isOpenForRegistration: false });

    const openSlot = await prisma.mealSlot.findFirstOrThrow({ where: { shabbatId, status: 'OPEN' } });
    const product = openSlot.category === 'MAIN' ? products.meatballs : openSlot.category === 'SALAD' ? products.salad : products.cake;
    const late = await api().post('/api/assignments').set(bearer(rivkaNow)).send({ slotId: openSlot.id, productId: product });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('SHABBAT_CLOSED');

    // המנהלת לא יכולה לערוך את השבת או המשבצות אחרי הסגירה
    expect((await api().put(`/api/shabbatot/${shabbatId}`).set(bearer(adminNow)).send({ message: 'x' })).status).toBe(409);
    expect((await api().delete(`/api/slots/${openSlot.id}`).set(bearer(adminNow))).status).toBe(409);
  });

  it('דוח שבוע ולוח בקרה', async () => {
    const report = await api().get(`/api/reports/week/${shabbatId}`).set(bearer(admin));
    expect(report.status).toBe(200);
    expect(report.body).toMatchObject({
      familiesCount: 2,
      slotCounts: { total: 6, open: 4, taken: 1, delivered: 1 },
      volunteersCount: 2,
      totalPortions: 7 * 3 + 4 * 3,
    });
    expect(report.body.familiesMissing.length).toBe(2);

    const dashboard = await api().get('/api/reports/dashboard').set(bearer(admin));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body).toMatchObject({ pendingVolunteers: 1, activeFamilies: 3 });
    expect(dashboard.body.upcomingShabbat.shabbat.id).toBe(shabbatId);
  });

  it('ייצוא CSV עם עברית (BOM) ושם קובץ', async () => {
    const res = await api().get(`/api/reports/week/${shabbatId}/export`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`shabbat-${dateStr(shabbatDate)}.csv`);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('משפחת לוי הסודית');
    expect(res.text.split('\r\n')).toHaveLength(7);
  });

  it('רשימת שבתות וסגירה ידנית', async () => {
    const list = await api().get('/api/shabbatot').set(bearer(admin));
    expect(list.body[0]).toMatchObject({ id: shabbatId, familiesCount: 2 });

    const close = await api().patch(`/api/shabbatot/${shabbatId}/close`).set(bearer(admin));
    expect(close.status).toBe(200);
    expect(close.body.status).toBe('CLOSED');
    expect((await api().get('/api/shabbatot?status=CLOSED').set(bearer(admin))).body).toHaveLength(1);
  });

  it('טיוטה: אפשר לשנות תאריך ולמחוק', async () => {
    const draft = await api().post('/api/shabbatot').set(bearer(admin)).send({ shabbatDate: dateStr(futureShabbat(3)), parasha: 'לך לך' });
    const moved = await api().put(`/api/shabbatot/${draft.body.id}`).set(bearer(admin)).send({ shabbatDate: dateStr(futureShabbat(4)) });
    expect(moved.status).toBe(200);
    expect(moved.body.deliveryDeadline).toBe(deliveryDeadlineFor(futureShabbat(4)).toISOString());

    // מתנדבת לא יודעת על משבצות בטיוטה
    await api().post(`/api/shabbatot/${draft.body.id}/generate-slots`).set(bearer(admin)).send();
    const draftSlot = await prisma.mealSlot.findFirstOrThrow({ where: { shabbatId: draft.body.id, category: 'MAIN' } });
    const hidden = await api().post('/api/assignments').set(bearer(sara)).send({ slotId: draftSlot.id, productId: products.chicken });
    expect(hidden.status).toBe(404);

    expect((await api().delete(`/api/shabbatot/${draft.body.id}`).set(bearer(admin))).status).toBe(204);
    expect(await prisma.mealSlot.count({ where: { shabbatId: draft.body.id } })).toBe(0);
  });
});
