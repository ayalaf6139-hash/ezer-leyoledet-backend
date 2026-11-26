import { beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  bearer,
  createFamily,
  createProduct,
  createPublishedShabbat,
  createUser,
  loginAs,
  prisma,
  resetDb,
} from './helpers';

describe('מחיקת מתנדבות', () => {
  let adminToken: string;
  let adminId: number;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ role: 'ADMIN' });
    adminId = admin.id;
    adminToken = await loginAs(admin.email);
  });

  it('מנהלת מוחקת בקשת הצטרפות ממתינה', async () => {
    const pending = await createUser({ status: 'PENDING' });
    const res = await api().delete(`/api/users/${pending.id}`).set(bearer(adminToken));
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: pending.id } })).toBeNull();
  });

  it('מתנדבת שנמחקה מאבדת גישה מיד', async () => {
    const volunteer = await createUser();
    const token = await loginAs(volunteer.email);
    expect((await api().delete(`/api/users/${volunteer.id}`).set(bearer(adminToken))).status).toBe(204);
    const res = await api().put('/api/users/me').set(bearer(token)).send({ phone: '0529999999' });
    expect(res.status).toBe(401);
  });

  it('מתנדבת עם שיבוץ פעיל → 409, ואפשר רק להשבית', async () => {
    const volunteer = await createUser();
    const shabbat = await createPublishedShabbat();
    const family = await createFamily();
    const product = await createProduct('עוף', 'MAIN');
    const slot = await prisma.mealSlot.create({
      data: { shabbatId: shabbat.id, familyId: family.id, category: 'MAIN', portions: 4, status: 'TAKEN' },
    });
    await prisma.assignment.create({ data: { slotId: slot.id, userId: volunteer.id, productId: product.id } });

    const res = await api().delete(`/api/users/${volunteer.id}`).set(bearer(adminToken));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_HAS_ASSIGNMENTS');
    expect(await prisma.user.findUnique({ where: { id: volunteer.id } })).not.toBeNull();
  });

  it('שיבוצים מבוטלים לא מונעים מחיקה', async () => {
    const volunteer = await createUser();
    const slot = await prisma.mealSlot.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow();
    await prisma.assignment.create({
      data: { slotId: slot.id, userId: volunteer.id, productId: product.id, status: 'CANCELLED', cancelledAt: new Date() },
    });
    const res = await api().delete(`/api/users/${volunteer.id}`).set(bearer(adminToken));
    expect(res.status).toBe(204);
    expect(await prisma.assignment.count({ where: { userId: volunteer.id } })).toBe(0);
  });

  it('אי אפשר למחוק מנהלת או את עצמך', async () => {
    const self = await api().delete(`/api/users/${adminId}`).set(bearer(adminToken));
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('CANNOT_DELETE_SELF');

    const otherAdmin = await createUser({ role: 'ADMIN' });
    const res = await api().delete(`/api/users/${otherAdmin.id}`).set(bearer(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DELETE_ADMIN');
  });

  it('מתנדבת לא יכולה למחוק, ומזהה לא קיים → 404', async () => {
    const volunteer = await createUser();
    const other = await createUser();
    const token = await loginAs(volunteer.email);
    expect((await api().delete(`/api/users/${other.id}`).set(bearer(token))).status).toBe(403);
    expect((await api().delete('/api/users/99999').set(bearer(adminToken))).status).toBe(404);
  });
});
