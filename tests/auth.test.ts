import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, createUser, devOutbox, loginAs, PASSWORD, prisma, resetDb, waitFor } from './helpers';

describe('התחברות (login)', () => {
  let adminEmail: string;
  let volunteerEmail: string;

  beforeAll(async () => {
    await resetDb();
    adminEmail = (await createUser({ role: 'ADMIN', email: 'admin@test.local' })).email;
    volunteerEmail = (await createUser({ email: 'vol@test.local' })).email;
    await createUser({ email: 'pending@test.local', status: 'PENDING' });
    await createUser({ email: 'inactive@test.local', status: 'INACTIVE' });
  });

  it('login תקין מחזיר Token ופרטי משתמשת, בלי סיסמה', async () => {
    const res = await api().post('/api/auth/login').send({ email: adminEmail, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.user).toMatchObject({ email: adminEmail, role: 'ADMIN' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|resetToken/);
  });

  it('האימייל לא תלוי באותיות גדולות/קטנות', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'VOL@Test.Local', password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('סיסמה שגויה → 401', async () => {
    const res = await api().post('/api/auth/login').send({ email: volunteerEmail, password: 'Wrong12345' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('אימייל לא קיים → 401 עם אותה הודעה', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nobody@test.local', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('חשבון ממתין לאישור → 403 ACCOUNT_PENDING', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'pending@test.local', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });

  it('חשבון מושבת → 403 ACCOUNT_INACTIVE', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'inactive@test.local', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('גוף ריק → 400 ולידציה', async () => {
    const res = await api().post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Token – GET /api/auth/me', () => {
  let token: string;
  let userId: number;

  beforeAll(async () => {
    await resetDb();
    const user = await createUser({ email: 'me@test.local' });
    userId = user.id;
    token = await loginAs(user.email);
  });

  it('Token תקין → פרטי המשתמשת', async () => {
    const res = await api().get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: userId, email: 'me@test.local' });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('בלי Token → 401 TOKEN_MISSING', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('Token משובש → 401 TOKEN_INVALID', async () => {
    const res = await api().get('/api/auth/me').set(bearer('not.a.real.token'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('Token שנחתם בסוד אחר → 401 TOKEN_INVALID', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-that-is-long-enough-123456', { subject: String(userId) });
    const res = await api().get('/api/auth/me').set(bearer(forged));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('Token שפג תוקפו → 401 TOKEN_EXPIRED', async () => {
    const expired = jwt.sign({ role: 'VOLUNTEER' }, process.env.JWT_SECRET as string, {
      subject: String(userId),
      expiresIn: -10,
    });
    const res = await api().get('/api/auth/me').set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('חשבון שהושבת מאבד גישה מיד, גם עם Token תקף → 401', async () => {
    const user = await createUser();
    const userToken = await loginAs(user.email);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
    const res = await api().get('/api/auth/me').set(bearer(userToken));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('הרשאת מנהלת נקבעת לפי המסד ולא לפי מה שכתוב ב-Token', async () => {
    // Token חתום נכון שבו כתוב role=ADMIN, של מתנדבת – עדיין 403
    const fakeAdmin = jwt.sign({ role: 'ADMIN' }, process.env.JWT_SECRET as string, { subject: String(userId), expiresIn: 60 });
    const res = await api().get('/api/families').set(bearer(fakeAdmin));
    expect(res.status).toBe(403);
  });
});

describe('הרשמה ואיפוס סיסמה', () => {
  beforeAll(async () => {
    await resetDb();
    await createUser({ role: 'ADMIN', email: 'admin@test.local' });
  });

  it('הרשמה יוצרת חשבון PENDING ושולחת מייל למנהלת', async () => {
    const res = await api().post('/api/auth/register').send({
      firstName: 'מרים',
      lastName: 'פרץ',
      phone: '054-111-2233',
      email: 'Miriam@Test.Local',
      password: 'Miriam123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ status: 'PENDING', role: 'VOLUNTEER', email: 'miriam@test.local', phone: '0541112233' });
    expect(res.body.user.passwordHash).toBeUndefined();
    await waitFor(() => devOutbox.some((m) => m.to.email === 'admin@test.local' && m.subject.includes('בקשת הצטרפות')));
  });

  it('אי אפשר להירשם כמנהלת דרך ההרשמה', async () => {
    const res = await api().post('/api/auth/register').send({
      firstName: 'פורצת',
      lastName: 'מנסה',
      phone: '0541112233',
      email: 'hacker@test.local',
      password: 'Hacker123',
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toContain('role');
  });

  it('אימייל קיים → 409 EMAIL_TAKEN', async () => {
    const res = await api().post('/api/auth/register').send({
      firstName: 'מרים',
      lastName: 'שנייה',
      phone: '0541112233',
      email: 'miriam@test.local',
      password: 'Miriam123',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('ולידציה: מחזיר רשימת שדות שגויים בעברית', async () => {
    const res = await api().post('/api/auth/register').send({ firstName: 'א', email: 'not-an-email', password: 'short', phone: '123' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['firstName', 'lastName', 'email', 'password', 'phone']));
  });

  it('שכחתי סיסמה → קישור במייל → סיסמה חדשה עובדת', async () => {
    const user = await createUser({ email: 'forgot@test.local' });
    devOutbox.length = 0;

    const forgot = await api().post('/api/auth/forgot-password').send({ email: user.email });
    expect(forgot.status).toBe(200);
    const mail = devOutbox.find((m) => m.to.email === user.email);
    expect(mail).toBeDefined();
    const token = mail!.html.match(/token=([a-f0-9]{64})/)![1];

    const reset = await api().post('/api/auth/reset-password').send({ token, password: 'BrandNew123' });
    expect(reset.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: user.email, password: 'BrandNew123' })).status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(401);

    // הקישור חד-פעמי
    const again = await api().post('/api/auth/reset-password').send({ token, password: 'Another123' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('שכחתי סיסמה לכתובת לא קיימת – אותה תשובה, בלי מייל', async () => {
    devOutbox.length = 0;
    const res = await api().post('/api/auth/forgot-password').send({ email: 'ghost@test.local' });
    expect(res.status).toBe(200);
    expect(devOutbox).toHaveLength(0);
  });

  it('קוד איפוס שפג תוקפו → 400', async () => {
    const user = await createUser();
    devOutbox.length = 0;
    await api().post('/api/auth/forgot-password').send({ email: user.email });
    const token = devOutbox[0].html.match(/token=([a-f0-9]{64})/)![1];
    await prisma.user.update({ where: { id: user.id }, data: { resetTokenExpires: new Date(Date.now() - 1000) } });
    const res = await api().post('/api/auth/reset-password').send({ token, password: 'BrandNew123' });
    expect(res.status).toBe(400);
  });
});
