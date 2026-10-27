import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, createUser, devOutbox, loginAs, PASSWORD, prisma, resetDb, waitFor } from './helpers';

describe('הרשאות מנהלת / מתנדבת', () => {
  let adminToken: string;
  let volunteerToken: string;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ role: 'ADMIN' });
    const volunteer = await createUser();
    adminToken = await loginAs(admin.email);
    volunteerToken = await loginAs(volunteer.email);
  });

  const adminOnly: [string, string][] = [
    ['get', '/api/users'],
    ['post', '/api/users'],
    ['get', '/api/users/1'],
    ['patch', '/api/users/1'],
    ['get', '/api/families'],
    ['post', '/api/families'],
    ['get', '/api/families/1'],
    ['put', '/api/families/1'],
    ['delete', '/api/families/1'],
    ['post', '/api/products'],
    ['put', '/api/products/1'],
    ['delete', '/api/products/1'],
    ['get', '/api/shabbatot'],
    ['post', '/api/shabbatot'],
    ['get', '/api/shabbatot/1'],
    ['put', '/api/shabbatot/1'],
    ['delete', '/api/shabbatot/1'],
    ['post', '/api/shabbatot/1/generate-slots'],
    ['patch', '/api/shabbatot/1/publish'],
    ['patch', '/api/shabbatot/1/close'],
    ['post', '/api/slots'],
    ['put', '/api/slots/1'],
    ['delete', '/api/slots/1'],
    ['get', '/api/assignments'],
    ['get', '/api/reports/dashboard'],
    ['get', '/api/reports/week/1'],
    ['get', '/api/reports/week/1/export'],
  ];

  it.each(adminOnly)('%s %s – מתנדבת מקבלת 403', async (method, url) => {
    const res = await (api() as unknown as Record<string, (u: string) => import('supertest').Test>)[method](url)
      .set(bearer(volunteerToken))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each(adminOnly)('%s %s – בלי Token מקבלים 401', async (method, url) => {
    const res = await (api() as unknown as Record<string, (u: string) => import('supertest').Test>)[method](url).send({});
    expect(res.status).toBe(401);
  });

  it('מנהלת ניגשת לנתיבי מנהלת', async () => {
    expect((await api().get('/api/families').set(bearer(adminToken))).status).toBe(200);
    expect((await api().get('/api/users').set(bearer(adminToken))).status).toBe(200);
    expect((await api().get('/api/reports/dashboard').set(bearer(adminToken))).status).toBe(200);
  });

  it('נתיבים לכל מחוברת עובדים גם למתנדבת', async () => {
    expect((await api().get('/api/products').set(bearer(volunteerToken))).status).toBe(200);
    expect((await api().get('/api/shabbatot/current').set(bearer(volunteerToken))).status).toBe(200);
    expect((await api().get('/api/assignments/mine').set(bearer(volunteerToken))).status).toBe(200);
  });

  it('משימות מתוזמנות: בלי קוד → 401, קוד שגוי → 401, קוד נכון → 200', async () => {
    expect((await api().post('/api/jobs/open-slots-report')).status).toBe(401);
    expect((await api().post('/api/jobs/open-slots-report').set('X-Cron-Secret', 'wrong-secret-000000')).status).toBe(401);
    // גם Token של מנהלת לא מספיק – צריך את הקוד הסודי
    expect((await api().post('/api/jobs/open-slots-report').set(bearer(adminToken))).status).toBe(401);
    const ok = await api().post('/api/jobs/open-slots-report').set('X-Cron-Secret', process.env.CRON_SECRET as string);
    expect(ok.status).toBe(200);
  });
});

describe('ניהול מתנדבות ופרופיל', () => {
  let adminToken: string;
  let adminId: number;
  let volunteer: { id: number; email: string };
  let volunteerToken: string;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ role: 'ADMIN' });
    adminId = admin.id;
    adminToken = await loginAs(admin.email);
    volunteer = await createUser({ firstName: 'שרה' });
    volunteerToken = await loginAs(volunteer.email);
    await createUser({ firstName: 'רבקה', status: 'PENDING', email: 'rivka@test.local' });
    await createUser({ firstName: 'לאה', status: 'INACTIVE' });
  });

  it('רשימת מתנדבות: חיפוש וסינון לפי סטטוס, בלי המנהלת ובלי סיסמאות', async () => {
    const all = await api().get('/api/users').set(bearer(adminToken));
    expect(all.body.total).toBe(3);
    expect(all.body.items.every((u: { role: string }) => u.role === 'VOLUNTEER')).toBe(true);
    expect(JSON.stringify(all.body)).not.toContain('passwordHash');

    const pending = await api().get('/api/users?status=PENDING').set(bearer(adminToken));
    expect(pending.body.items.map((u: { firstName: string }) => u.firstName)).toEqual(['רבקה']);

    const search = await api().get(`/api/users?q=${encodeURIComponent('שרה')}`).set(bearer(adminToken));
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0]).toHaveProperty('assignmentsCount', 0);
  });

  it('עמודים: pageSize=2 מחזיר 2 רשומות ו-totalPages=2', async () => {
    const res = await api().get('/api/users?pageSize=2&sortBy=firstName&order=asc').set(bearer(adminToken));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.totalPages).toBe(2);
  });

  it('אישור בקשת הצטרפות שולח מייל, ואז אפשר להתחבר', async () => {
    const pending = await prisma.user.findUniqueOrThrow({ where: { email: 'rivka@test.local' } });
    devOutbox.length = 0;
    const res = await api().patch(`/api/users/${pending.id}`).set(bearer(adminToken)).send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    await waitFor(() => devOutbox.some((m) => m.to.email === 'rivka@test.local'));
    expect((await api().post('/api/auth/login').send({ email: 'rivka@test.local', password: PASSWORD })).status).toBe(200);
  });

  it('אי אפשר להשבית את המנהלת', async () => {
    const res = await api().patch(`/api/users/${adminId}`).set(bearer(adminToken)).send({ status: 'INACTIVE' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_CHANGE_ADMIN_STATUS');
  });

  it('מתנדבת לא קיימת → 404', async () => {
    const res = await api().get('/api/users/99999').set(bearer(adminToken));
    expect(res.status).toBe(404);
  });

  it('הוספת מתנדבת ישירה בלי סיסמה שולחת מייל הזמנה', async () => {
    devOutbox.length = 0;
    const res = await api().post('/api/users').set(bearer(adminToken)).send({
      firstName: 'חנה',
      lastName: 'מזרחי',
      phone: '0503334455',
      email: 'hana@test.local',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('ACTIVE');
    expect(res.body.inviteEmailSent).toBe(true);
    expect(devOutbox.find((m) => m.to.email === 'hana@test.local')?.html).toMatch(/reset-password\?token=/);
  });

  it('עדכון הפרופיל שלי – רק השדות המותרים', async () => {
    const res = await api().put('/api/users/me').set(bearer(volunteerToken)).send({ phone: '050-777-8888', receiveWeeklyEmail: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ phone: '0507778888', receiveWeeklyEmail: false });

    const escalate = await api().put('/api/users/me').set(bearer(volunteerToken)).send({ role: 'ADMIN' });
    expect(escalate.status).toBe(400);
    const status = await api().put('/api/users/me').set(bearer(volunteerToken)).send({ status: 'ACTIVE' });
    expect(status.status).toBe(400);
  });

  it('שינוי סיסמה: סיסמה נוכחית שגויה → 400, נכונה → מצליח', async () => {
    const wrong = await api().put('/api/users/me/password').set(bearer(volunteerToken)).send({ currentPassword: 'nope', newPassword: 'NewPass123' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');

    const ok = await api().put('/api/users/me/password').set(bearer(volunteerToken)).send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: volunteer.email, password: 'NewPass123' })).status).toBe(200);
  });
});
