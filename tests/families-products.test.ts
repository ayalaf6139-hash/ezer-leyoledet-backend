import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, createUser, loginAs, resetDb } from './helpers';

const validFamily = {
  familyName: 'משפחת לוי',
  contactPhone: '052-7654321',
  address: 'רחוב השלום 12',
  peopleCount: 7,
  simchaType: 'בן',
  firstShabbat: '2026-10-17',
  lastShabbat: '2026-11-07',
  dietaryNotes: 'ללא גלוטן',
  deliveryNotes: 'להשאיר ליד הדלת',
};

describe('משפחות – CRUD, חיפוש וסינון', () => {
  let admin: string;

  beforeAll(async () => {
    await resetDb();
    admin = await loginAs((await createUser({ role: 'ADMIN' })).email);
  });

  it('הוספת משפחה', async () => {
    const res = await api().post('/api/families').set(bearer(admin)).send(validFamily);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...validFamily, contactPhone: '0527654321', status: 'ACTIVE' });
    expect(res.body.id).toEqual(expect.any(Number));
  });

  it('ולידציה: מספר נפשות 0, שבת אחרונה לפני הראשונה, תאריך לא תקין', async () => {
    const res = await api()
      .post('/api/families')
      .set(bearer(admin))
      .send({ ...validFamily, peopleCount: 0, firstShabbat: '2026-11-07', lastShabbat: '2026-10-17' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('peopleCount');

    const range = await api().post('/api/families').set(bearer(admin)).send({ ...validFamily, firstShabbat: '2026-11-07', lastShabbat: '2026-10-17' });
    expect(range.status).toBe(400);
    expect(range.body.error.details[0].field).toBe('lastShabbat');

    const badDate = await api().post('/api/families').set(bearer(admin)).send({ ...validFamily, firstShabbat: '17/10/2026' });
    expect(badDate.status).toBe(400);
  });

  it('עריכה, צפייה וסיום סיוע', async () => {
    const created = await api().post('/api/families').set(bearer(admin)).send({ ...validFamily, familyName: 'משפחת כץ' });
    const id = created.body.id;

    const updated = await api().put(`/api/families/${id}`).set(bearer(admin)).send({ peopleCount: 8 });
    expect(updated.status).toBe(200);
    expect(updated.body.peopleCount).toBe(8);
    expect(updated.body.familyName).toBe('משפחת כץ');

    const badRange = await api().put(`/api/families/${id}`).set(bearer(admin)).send({ lastShabbat: '2026-10-10' });
    expect(badRange.status).toBe(400);

    const got = await api().get(`/api/families/${id}`).set(bearer(admin));
    expect(got.status).toBe(200);
    expect(got.body.slots).toEqual([]);

    const finished = await api().delete(`/api/families/${id}`).set(bearer(admin));
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe('FINISHED');
  });

  it('משפחה לא קיימת → 404, מזהה לא מספרי → 400', async () => {
    expect((await api().get('/api/families/99999').set(bearer(admin))).status).toBe(404);
    expect((await api().get('/api/families/abc').set(bearer(admin))).status).toBe(400);
  });

  it('חיפוש, סינון ומיון', async () => {
    await api().post('/api/families').set(bearer(admin)).send({ ...validFamily, familyName: 'משפחת אדלר', peopleCount: 3 });

    const search = await api().get(`/api/families?q=${encodeURIComponent('אדלר')}`).set(bearer(admin));
    expect(search.body.items.map((f: { familyName: string }) => f.familyName)).toEqual(['משפחת אדלר']);

    const finished = await api().get('/api/families?status=FINISHED').set(bearer(admin));
    expect(finished.body.items.map((f: { familyName: string }) => f.familyName)).toEqual(['משפחת כץ']);

    const sorted = await api().get('/api/families?sortBy=peopleCount&order=asc').set(bearer(admin));
    const counts = sorted.body.items.map((f: { peopleCount: number }) => f.peopleCount);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));

    const badSort = await api().get('/api/families?sortBy=password').set(bearer(admin));
    expect(badSort.status).toBe(400);
  });
});

describe('מוצרים', () => {
  let admin: string;
  let volunteer: string;

  beforeAll(async () => {
    await resetDb();
    admin = await loginAs((await createUser({ role: 'ADMIN' })).email);
    volunteer = await loginAs((await createUser()).email);
  });

  it('הוספה, כפילות בתוך קטגוריה → 409, אותו שם בקטגוריה אחרת מותר', async () => {
    const res = await api().post('/api/products').set(bearer(admin)).send({ name: 'עוף בתנור', category: 'MAIN' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'עוף בתנור', category: 'MAIN', categoryLabel: 'תבשיל', isActive: true });

    const dup = await api().post('/api/products').set(bearer(admin)).send({ name: 'עוף בתנור', category: 'MAIN' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PRODUCT_EXISTS');

    expect((await api().post('/api/products').set(bearer(admin)).send({ name: 'עוף בתנור', category: 'OTHER' })).status).toBe(201);
  });

  it('קטגוריה לא חוקית → 400', async () => {
    const res = await api().post('/api/products').set(bearer(admin)).send({ name: 'פיצה', category: 'PIZZA' });
    expect(res.status).toBe(400);
  });

  it('סינון לפי קטגוריה וחיפוש', async () => {
    await api().post('/api/products').set(bearer(admin)).send({ name: 'סלט ירקות', category: 'SALAD' });
    await api().post('/api/products').set(bearer(admin)).send({ name: 'סלט כרוב', category: 'SALAD' });

    const salads = await api().get('/api/products?category=SALAD').set(bearer(volunteer));
    expect(salads.body.map((p: { name: string }) => p.name)).toEqual(['סלט ירקות', 'סלט כרוב']);

    const search = await api().get(`/api/products?q=${encodeURIComponent('כרוב')}`).set(bearer(volunteer));
    expect(search.body).toHaveLength(1);
  });

  it('השבתה: מוצר מושבת לא מוצג למתנדבת, מנהלת יכולה לראות ולהחזיר', async () => {
    const product = await api().post('/api/products').set(bearer(admin)).send({ name: 'עוגת שמרים', category: 'DESSERT' });
    const off = await api().delete(`/api/products/${product.body.id}`).set(bearer(admin));
    expect(off.body.isActive).toBe(false);

    const forVolunteer = await api().get('/api/products?category=DESSERT&includeInactive=true').set(bearer(volunteer));
    expect(forVolunteer.body).toHaveLength(0);

    const forAdmin = await api().get('/api/products?category=DESSERT&includeInactive=true').set(bearer(admin));
    expect(forAdmin.body).toHaveLength(1);

    const back = await api().put(`/api/products/${product.body.id}`).set(bearer(admin)).send({ isActive: true });
    expect(back.body.isActive).toBe(true);
  });
});
