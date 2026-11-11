import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, createUser, devOutbox, loginAs, prisma, resetDb, waitFor } from './helpers';

describe('משפחות מוסרות תודה', () => {
  let adminToken: string;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ role: 'ADMIN' });
    adminToken = await loginAs(admin.email);
  });

  it('כל אחד כותב תודה, והיא לא מוצגת עד אישור', async () => {
    const res = await api().post('/api/thanks').send({ familyName: 'משפחת כהן', message: 'תודה ענקית לכל המבשלות!' });
    expect(res.status).toBe(201);
    await waitFor(() => devOutbox.some((m) => m.subject.includes('משפחת כהן')));

    const pub = await api().get('/api/thanks');
    expect(pub.status).toBe(200);
    expect(pub.body).toEqual([]);
  });

  it('שדות חסרים או קצרים מדי מחזירים 400', async () => {
    expect((await api().post('/api/thanks').send({ familyName: 'כ', message: '' })).status).toBe(400);
    expect((await api().post('/api/thanks').send({ familyName: 'משפחת לוי', message: 'תודה רבה!', extra: 1 })).status).toBe(400);
  });

  it('מנהלת מאשרת → התודה מוצגת בדף הבית; הסתרה מסירה אותה', async () => {
    const pending = await api().get('/api/thanks/admin?status=PENDING').set(bearer(adminToken));
    expect(pending.status).toBe(200);
    expect(pending.body.total).toBe(1);
    const id = pending.body.items[0].id;

    const approved = await api().patch(`/api/thanks/${id}`).set(bearer(adminToken)).send({ status: 'APPROVED' });
    expect(approved.status).toBe(200);
    expect(approved.body.reviewedAt).not.toBeNull();

    const pub = await api().get('/api/thanks');
    expect(pub.body).toHaveLength(1);
    expect(pub.body[0]).toEqual({
      id,
      familyName: 'משפחת כהן',
      message: 'תודה ענקית לכל המבשלות!',
      createdAt: expect.any(String),
    });

    await api().patch(`/api/thanks/${id}`).set(bearer(adminToken)).send({ status: 'HIDDEN' });
    expect((await api().get('/api/thanks')).body).toEqual([]);
  });

  it('מחיקה', async () => {
    const { id } = await prisma.thankYou.create({ data: { familyName: 'משפחת לוי', message: 'תודה רבה רבה' } });
    expect((await api().delete(`/api/thanks/${id}`).set(bearer(adminToken))).status).toBe(204);
    expect((await api().delete(`/api/thanks/${id}`).set(bearer(adminToken))).status).toBe(404);
  });
});

describe('הוספת כמה מתנדבות בבת אחת', () => {
  let adminToken: string;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ role: 'ADMIN' });
    await createUser({ email: 'taken@test.local' });
    adminToken = await loginAs(admin.email);
  });

  it('יוצר את התקינות ומדווח על השגויות לפי מספר שורה', async () => {
    const res = await api()
      .post('/api/users/bulk')
      .set(bearer(adminToken))
      .send({
        volunteers: [
          { firstName: 'חנה', lastName: 'מזרחי', phone: '050-3334455', email: 'Hana@Test.local' },
          { firstName: 'רחל', lastName: 'לוי', phone: '0521112233', email: 'taken@test.local' },
          { firstName: 'שרה', lastName: 'כץ', phone: '123', email: 'sara@test.local' },
          { firstName: 'חנה', lastName: 'שנייה', phone: '0503334455', email: 'hana@test.local' },
          { firstName: 'לאה', lastName: 'גולד', phone: '0541234567', email: 'leah@test.local' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.createdCount).toBe(2);
    expect(res.body.failed.map((f: { row: number }) => f.row)).toEqual([2, 3, 4]);
    expect(res.body.failed[0].reason).toContain('כבר רשומה');
    expect(res.body.failed[1].reason).toContain('טלפון');
    expect(res.body.failed[2].reason).toContain('פעמיים');

    const created = await prisma.user.findMany({ where: { email: { in: ['hana@test.local', 'leah@test.local'] } } });
    expect(created).toHaveLength(2);
    expect(created.every((u) => u.status === 'ACTIVE' && u.role === 'VOLUNTEER')).toBe(true);
    expect(devOutbox.filter((m) => m.to.email === 'leah@test.local')).toHaveLength(1);
  });

  it('רשימה ריקה או ארוכה מדי מחזירה 400', async () => {
    expect((await api().post('/api/users/bulk').set(bearer(adminToken)).send({ volunteers: [] })).status).toBe(400);
    const tooMany = Array.from({ length: 101 }, () => ({}));
    expect((await api().post('/api/users/bulk').set(bearer(adminToken)).send({ volunteers: tooMany })).status).toBe(400);
  });
});

describe('מינוי והסרה של מנהלות', () => {
  let adminId: number;
  let adminToken: string;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ role: 'ADMIN' });
    adminId = admin.id;
    adminToken = await loginAs(admin.email);
  });

  it('אי אפשר להסיר את המנהלת האחרונה או לשנות הרשאה של עצמך', async () => {
    const res = await api().patch(`/api/users/${adminId}`).set(bearer(adminToken)).send({ role: 'VOLUNTEER' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
  });

  it('אי אפשר למנות חשבון שעוד לא אושר', async () => {
    const pending = await createUser({ status: 'PENDING' });
    const res = await api().patch(`/api/users/${pending.id}`).set(bearer(adminToken)).send({ role: 'ADMIN' });
    expect(res.body.error.code).toBe('ADMIN_MUST_BE_ACTIVE');
  });

  it('מינוי מתנדבת למנהלת, והיא מופיעה ברשימת המנהלות ומקבלת גישה', async () => {
    const volunteer = await createUser();
    const res = await api().patch(`/api/users/${volunteer.id}`).set(bearer(adminToken)).send({ role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ADMIN');

    const admins = await api().get('/api/users?role=ADMIN').set(bearer(adminToken));
    expect(admins.body.items.map((u: { id: number }) => u.id).sort()).toEqual([adminId, volunteer.id].sort());

    const newToken = await loginAs(volunteer.email);
    expect((await api().get('/api/families').set(bearer(newToken))).status).toBe(200);

    const blocked = await api().patch(`/api/users/${volunteer.id}`).set(bearer(adminToken)).send({ status: 'INACTIVE' });
    expect(blocked.body.error.code).toBe('CANNOT_CHANGE_ADMIN_STATUS');

    const demoted = await api().patch(`/api/users/${volunteer.id}`).set(bearer(adminToken)).send({ role: 'VOLUNTEER' });
    expect(demoted.status).toBe(200);
    expect((await api().get('/api/families').set(bearer(newToken))).status).toBe(403);
  });
});
