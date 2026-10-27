import SwaggerParser from '@apidevtools/swagger-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/docs/openapi';
import { api, prisma, resetDb } from './helpers';

// כל נתיבי ה-API שמומשו בשרת – כל אחד חייב להופיע בתיעוד Swagger
const IMPLEMENTED_ROUTES = [
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/auth/me',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'PUT /api/users/me',
  'PUT /api/users/me/password',
  'GET /api/users',
  'POST /api/users',
  'GET /api/users/{id}',
  'PATCH /api/users/{id}',
  'GET /api/families',
  'POST /api/families',
  'GET /api/families/{id}',
  'PUT /api/families/{id}',
  'DELETE /api/families/{id}',
  'GET /api/products',
  'POST /api/products',
  'PUT /api/products/{id}',
  'DELETE /api/products/{id}',
  'GET /api/shabbatot/current',
  'GET /api/shabbatot',
  'POST /api/shabbatot',
  'GET /api/shabbatot/{id}',
  'PUT /api/shabbatot/{id}',
  'DELETE /api/shabbatot/{id}',
  'POST /api/shabbatot/{id}/generate-slots',
  'PATCH /api/shabbatot/{id}/publish',
  'PATCH /api/shabbatot/{id}/close',
  'POST /api/slots',
  'PUT /api/slots/{id}',
  'DELETE /api/slots/{id}',
  'POST /api/assignments',
  'GET /api/assignments',
  'GET /api/assignments/mine',
  'DELETE /api/assignments/{id}',
  'PATCH /api/assignments/{id}/delivered',
  'GET /api/reports/dashboard',
  'GET /api/reports/week/{id}',
  'GET /api/reports/week/{id}/export',
  'POST /api/jobs/thursday-reminders',
  'POST /api/jobs/open-slots-report',
];

describe('בריאות השרת', () => {
  beforeAll(resetDb);

  it('GET /api/health מחזיר 200 כשהמסד זמין', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('נתיב שלא קיים מחזיר 404 במבנה השגיאה האחיד', async () => {
    const res = await api().get('/api/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('JSON לא תקין מחזיר 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('CORS מאפשר את כתובת ה-React שהוגדרה', async () => {
    const res = await api().options('/api/auth/login').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('Swagger / OpenAPI', () => {
  it('המסמך הוא OpenAPI 3 תקין', async () => {
    const copy = JSON.parse(JSON.stringify(openApiDocument));
    await expect(SwaggerParser.validate(copy)).resolves.toBeTruthy();
    expect(openApiDocument.openapi).toMatch(/^3\./);
  });

  it('כל הנתיבים שמומשו מתועדים, ואין נתיבים מתועדים שלא קיימים', () => {
    const documented = Object.entries(openApiDocument.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(documented.sort()).toEqual([...IMPLEMENTED_ROUTES].sort());
  });

  it('יש סכמת אבטחה Bearer JWT (כפתור Authorize) ונתיבים מוגנים מסומנים', () => {
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    const me = openApiDocument.paths['/api/auth/me'].get as { security?: unknown };
    expect(me.security).toEqual([{ bearerAuth: [] }]);
  });

  it('Swagger UI נפתח ב-/api-docs, וה-JSON זמין ב-/api-docs/openapi.json', async () => {
    const html = await api().get('/api-docs/');
    expect(html.status).toBe(200);
    expect(html.text).toContain('swagger-ui');
    const json = await api().get('/api-docs/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.info.title).toBe('עזר ליולדת – API');
  });
});

describe('תקינות מסד הנתונים (Prisma + migrations)', () => {
  it('כל הטבלאות קיימות', async () => {
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    const names = rows.map((r) => r.tablename);
    for (const table of ['users', 'families', 'products', 'shabbatot', 'meal_slots', 'assignments']) {
      expect(names).toContain(table);
    }
  });

  it('קיים האינדקס הייחודי החלקי שמונע שני שיבוצים פעילים לאותה משבצת', async () => {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'assignments_one_live_per_slot'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain('UNIQUE');
    expect(rows[0].indexdef).toContain('CANCELLED');
  });

  it('אילוץ במסד מונע תאריך שבת שאינו יום שבת', async () => {
    await expect(
      prisma.shabbat.create({
        data: {
          shabbatDate: new Date('2026-10-22T00:00:00Z'),
          parasha: 'x',
          collectionPoint: 'x',
          deliveryDeadline: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
