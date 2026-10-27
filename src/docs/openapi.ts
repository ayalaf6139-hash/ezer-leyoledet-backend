// תיעוד ה-API בפורמט OpenAPI 3. מוצג ב-Swagger UI בכתובת /api-docs
// ונשמר גם כקובץ docs/openapi.json (npm run openapi).

type Schema = Record<string, unknown>;
type Auth = 'public' | 'user' | 'admin' | 'cron';

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (schema: Schema): Schema => ({ type: 'array', items: schema });
const str = (description?: string, example?: unknown): Schema => ({ type: 'string', ...(description ? { description } : {}), ...(example !== undefined ? { example } : {}) });
const int = (description?: string, example?: unknown): Schema => ({ type: 'integer', ...(description ? { description } : {}), ...(example !== undefined ? { example } : {}) });
const bool = (description?: string): Schema => ({ type: 'boolean', ...(description ? { description } : {}) });
const nullable = (schema: Schema): Schema => ({ ...schema, nullable: true });
const date = (description?: string, example = '2026-10-24'): Schema => ({ type: 'string', format: 'date', example, ...(description ? { description } : {}) });
const dateTime = (description?: string): Schema => ({ type: 'string', format: 'date-time', ...(description ? { description } : {}) });
const enumOf = (values: string[], description?: string): Schema => ({ type: 'string', enum: values, ...(description ? { description } : {}) });
const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
});

const CATEGORY = enumOf(['MAIN', 'SALAD', 'DESSERT', 'OTHER'], 'MAIN=תבשיל, SALAD=סלט, DESSERT=קינוח, OTHER=אחר');

const AUTH_TEXT: Record<Auth, string> = {
  public: '🔓 **הרשאה:** פתוח לכולם (ללא Token).',
  user: '👤 **הרשאה:** כל משתמשת מחוברת (Bearer Token).',
  admin: '🛡️ **הרשאה:** מנהלת בלבד (Bearer Token של מנהלת). מתנדבת תקבל 403.',
  cron: '🔑 **הרשאה:** קוד סודי בכותרת `X-Cron-Secret` (מיועד ל-cron-job.org, לא ל-React).',
};

interface OpOptions {
  tag: string;
  summary: string;
  description?: string;
  auth: Auth;
  path?: Schema[];
  query?: Schema[];
  body?: { schema: Schema; example?: unknown; required?: boolean };
  success: { status?: number; description: string; schema?: Schema; example?: unknown; contentType?: string };
  errors?: number[];
}

const ERROR_RESPONSES: Record<number, string> = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  429: 'TooManyRequests',
  503: 'ServiceUnavailable',
};

function op(o: OpOptions) {
  const errors = new Set(o.errors ?? []);
  if (o.auth === 'user' || o.auth === 'cron') errors.add(401);
  if (o.auth === 'admin') {
    errors.add(401);
    errors.add(403);
  }
  if (o.body) errors.add(400);

  const responses: Record<string, unknown> = {
    [String(o.success.status ?? 200)]: {
      description: o.success.description,
      ...(o.success.schema
        ? {
            content: {
              [o.success.contentType ?? 'application/json']: {
                schema: o.success.schema,
                ...(o.success.example !== undefined ? { example: o.success.example } : {}),
              },
            },
          }
        : {}),
    },
  };
  for (const code of Array.from(errors).sort()) {
    responses[String(code)] = { $ref: `#/components/responses/${ERROR_RESPONSES[code]}` };
  }

  return {
    tags: [o.tag],
    summary: o.summary,
    description: [o.description, AUTH_TEXT[o.auth]].filter(Boolean).join('\n\n'),
    ...(o.auth === 'user' || o.auth === 'admin' ? { security: [{ bearerAuth: [] }] } : {}),
    ...(o.auth === 'cron' ? { security: [{ cronSecret: [] }] } : {}),
    ...(o.path || o.query ? { parameters: [...(o.path ?? []), ...(o.query ?? [])] } : {}),
    ...(o.body
      ? {
          requestBody: {
            required: o.body.required ?? true,
            content: {
              'application/json': {
                schema: o.body.schema,
                ...(o.body.example !== undefined ? { example: o.body.example } : {}),
              },
            },
          },
        }
      : {}),
    responses,
  };
}

const idPath = (description = 'מזהה'): Schema => ({
  name: 'id',
  in: 'path',
  required: true,
  description,
  schema: { type: 'integer', minimum: 1 },
  example: 1,
});
const q = (name: string, schema: Schema, description: string): Schema => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
});
const pageParams = [
  q('page', { type: 'integer', minimum: 1, default: 1 }, 'מספר עמוד'),
  q('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'כמה רשומות בעמוד'),
];
const paginated = (item: string): Schema =>
  obj(
    {
      items: arrayOf(ref(item)),
      total: int('סך כל הרשומות', 42),
      page: int('העמוד הנוכחי', 1),
      pageSize: int('רשומות בעמוד', 20),
      totalPages: int('מספר העמודים', 3),
    },
    ['items', 'total', 'page', 'pageSize', 'totalPages'],
  );

// ---------- דוגמאות ----------

const exUser = {
  id: 2,
  firstName: 'שרה',
  lastName: 'כהן',
  email: 'sara@example.com',
  phone: '0521234567',
  address: 'רחוב הנביאים 5',
  role: 'VOLUNTEER',
  status: 'ACTIVE',
  receiveWeeklyEmail: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
};
const exFamily = {
  id: 1,
  familyName: 'משפחת לוי',
  contactPhone: '0527654321',
  address: 'רחוב השלום 12',
  peopleCount: 7,
  simchaType: 'בן',
  firstShabbat: '2026-10-17',
  lastShabbat: '2026-11-07',
  dietaryNotes: 'ללא גלוטן לאחד הילדים',
  deliveryNotes: 'להשאיר ליד הדלת',
  status: 'ACTIVE',
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-10T08:00:00.000Z',
};
const exProduct = { id: 1, name: 'עוף בתנור', category: 'MAIN', categoryLabel: 'תבשיל', description: 'עוף בתנור עם תפוחי אדמה', isActive: true, createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-01T09:00:00.000Z' };
const exShabbat = {
  id: 1,
  shabbatDate: '2026-10-24',
  parasha: 'נח',
  deliveryDeadline: '2026-10-22T18:00:00.000Z',
  cancelDeadline: '2026-10-21T18:00:00.000Z',
  collectionPoint: 'רחוב הרב קוק 12, בית השם',
  message: 'שבוע טוב לכולן! השבוע שלוש משפחות שמחות מחכות לעזרתנו',
  status: 'PUBLISHED',
  isOpenForRegistration: true,
  publishedAt: '2026-10-18T19:00:00.000Z',
  createdAt: '2026-10-18T18:00:00.000Z',
  updatedAt: '2026-10-18T19:00:00.000Z',
};
const exShabbatVolunteer = (({ createdAt: _c, updatedAt: _u, publishedAt: _p, ...rest }) => rest)(exShabbat);

// ---------- המסמך ----------

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'עזר ליולדת – API',
    version: '1.0.0',
    description: [
      'שרת API למערכת **"עזר ליולדת"** – תיאום ארוחות שבת למשפחות שמחות בקהילה.',
      '',
      '### איך בודקים מתוך Swagger',
      '1. פתחי את `POST /api/auth/login`, לחצי **Try it out** ואז **Execute** (פרטי ההתחברות לדוגמה כבר ממולאים).',
      '2. העתיקי את הערך של `token` מהתשובה.',
      '3. לחצי על הכפתור **Authorize** 🔓 למעלה, הדביקי את ה-Token (בלי המילה Bearer) ולחצי **Authorize**.',
      '4. מעכשיו כל הקריאות נשלחות עם ה-Token. כדי לבדוק 401 – לחצי **Logout** בחלון ה-Authorize ונסי שוב.',
      '5. כדי לבדוק 403 – התחברי כמתנדבת ונסי לקרוא לנתיב של מנהלת (למשל `GET /api/families`).',
      '',
      '### מבנה שגיאה אחיד',
      '```json',
      '{ "error": { "code": "SLOT_TAKEN", "message": "המשבצת נתפסה, בחרי אחרת" } }',
      '```',
      'בשגיאת ולידציה (400) מתווסף `details`: רשימה של `{ field, message }` – אפשר להציג כל הודעה ליד השדה המתאים בטופס.',
      '',
      '### תאריכים',
      'תאריך בלבד נשלח ומתקבל בפורמט `YYYY-MM-DD`. תאריך ושעה מוחזרים בפורמט ISO ב-UTC (יש להציג לפי שעון ישראל).',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'השרת הנוכחי' }],
  tags: [
    { name: 'כללי', description: 'בדיקת בריאות' },
    { name: 'התחברות', description: 'הרשמה, כניסה, פרטי המחוברת ואיפוס סיסמה' },
    { name: 'משתמשות', description: 'פרופיל אישי וניהול מתנדבות' },
    { name: 'משפחות', description: 'ניהול משפחות השמחות (מנהלת בלבד)' },
    { name: 'מוצרים', description: 'רשימת המאכלים שאפשר לבחור' },
    { name: 'שבתות', description: 'לוח השבוע, יצירה ופרסום של שבתות' },
    { name: 'משבצות', description: 'ניהול משבצות ידני (מנהלת בלבד)' },
    { name: 'שיבוצים', description: 'הרשמה למשבצות, ביטול וסימון "נמסר"' },
    { name: 'דוחות', description: 'לוח בקרה וסיכומים (מנהלת בלבד)' },
    { name: 'משימות מתוזמנות', description: 'תזכורות שמופעלות על ידי cron-job.org' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'ה-Token שמתקבל מ-POST /api/auth/login. נשלח בכותרת: Authorization: Bearer <token>',
      },
      cronSecret: { type: 'apiKey', in: 'header', name: 'X-Cron-Secret', description: 'הקוד הסודי מ-CRON_SECRET' },
    },
    schemas: {
      Category: CATEGORY,
      Error: obj(
        {
          error: obj(
            {
              code: str('קוד קבוע לזיהוי השגיאה בקוד', 'SLOT_TAKEN'),
              message: str('הודעה בעברית להצגה למשתמשת', 'המשבצת נתפסה, בחרי אחרת'),
              details: arrayOf(obj({ field: nullable(str('שם השדה', 'email')), message: str('ההודעה', 'כתובת אימייל אינה תקינה') })),
            },
            ['code', 'message'],
          ),
        },
        ['error'],
      ),
      Message: obj({ message: str('הודעת הצלחה', 'הפעולה בוצעה') }, ['message']),
      User: obj(
        {
          id: int(undefined, 2),
          firstName: str(undefined, 'שרה'),
          lastName: str(undefined, 'כהן'),
          email: str(undefined, 'sara@example.com'),
          phone: str('בלי מקפים', '0521234567'),
          address: nullable(str()),
          role: enumOf(['ADMIN', 'VOLUNTEER']),
          status: enumOf(['PENDING', 'ACTIVE', 'INACTIVE'], 'PENDING=ממתינה לאישור, ACTIVE=פעילה, INACTIVE=מושבתת'),
          receiveWeeklyEmail: bool('האם לקבל את מייל הפרסום השבועי'),
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
        ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'status', 'receiveWeeklyEmail'],
      ),
      AdminUser: { allOf: [ref('User'), obj({ notes: nullable(str('הערות פנימיות של המנהלת')) })] },
      VolunteerListItem: { allOf: [ref('AdminUser'), obj({ assignmentsCount: int('מספר השיבוצים שלא בוטלו', 4) })] },
      Family: obj(
        {
          id: int(undefined, 1),
          familyName: str(undefined, 'משפחת לוי'),
          contactPhone: nullable(str()),
          address: nullable(str()),
          peopleCount: int('מספר נפשות', 7),
          simchaType: str('סוג השמחה', 'בן'),
          firstShabbat: date('השבת הראשונה שבה המשפחה מקבלת', '2026-10-17'),
          lastShabbat: date('השבת האחרונה', '2026-11-07'),
          dietaryNotes: nullable(str('רגישויות והעדפות – גלוי גם למתנדבות')),
          deliveryNotes: nullable(str('הערות מסירה – למנהלת בלבד')),
          status: enumOf(['ACTIVE', 'FINISHED']),
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
        ['id', 'familyName', 'peopleCount', 'simchaType', 'firstShabbat', 'lastShabbat', 'status'],
      ),
      FamilyInput: obj(
        {
          familyName: { type: 'string', minLength: 2, maxLength: 100, example: 'משפחת לוי' },
          contactPhone: nullable(str('טלפון ישראלי', '052-7654321')),
          address: nullable({ type: 'string', maxLength: 200 }),
          peopleCount: { type: 'integer', minimum: 1, maximum: 30, example: 7 },
          simchaType: { type: 'string', minLength: 2, maxLength: 50, example: 'בן' },
          firstShabbat: date(undefined, '2026-10-17'),
          lastShabbat: date('חייבת להיות אחרי firstShabbat או שווה לה', '2026-11-07'),
          dietaryNotes: nullable({ type: 'string', maxLength: 500 }),
          deliveryNotes: nullable({ type: 'string', maxLength: 500 }),
        },
        ['familyName', 'peopleCount', 'simchaType', 'firstShabbat', 'lastShabbat'],
      ),
      Product: obj(
        {
          id: int(undefined, 1),
          name: str(undefined, 'עוף בתנור'),
          category: CATEGORY,
          categoryLabel: str('שם הקטגוריה בעברית', 'תבשיל'),
          description: nullable(str()),
          isActive: bool('מוצר מושבת לא מוצג לבחירה'),
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
        ['id', 'name', 'category', 'categoryLabel', 'isActive'],
      ),
      ProductInput: obj(
        {
          name: { type: 'string', minLength: 2, maxLength: 100, example: 'קציצות ברוטב' },
          category: CATEGORY,
          description: nullable({ type: 'string', maxLength: 300 }),
        },
        ['name', 'category'],
      ),
      Shabbat: obj(
        {
          id: int(undefined, 1),
          shabbatDate: date('תאריך השבת'),
          parasha: str(undefined, 'נח'),
          deliveryDeadline: dateTime('מועד המסירה: יום חמישי 21:00 שעון ישראל (מחושב אוטומטית)'),
          cancelDeadline: dateTime('עד מתי מתנדבת יכולה לבטל: יום רביעי 21:00'),
          collectionPoint: str('כתובת נקודת האיסוף'),
          message: nullable(str('דברי פתיחה')),
          status: enumOf(['DRAFT', 'PUBLISHED', 'CLOSED'], 'DRAFT=טיוטה, PUBLISHED=פתוח להרשמה, CLOSED=סגור (גם אוטומטית אחרי מועד המסירה)'),
          isOpenForRegistration: bool('האם אפשר להירשם עכשיו'),
          publishedAt: nullable(dateTime()),
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
        ['id', 'shabbatDate', 'parasha', 'deliveryDeadline', 'cancelDeadline', 'collectionPoint', 'status', 'isOpenForRegistration'],
      ),
      ShabbatListItem: {
        allOf: [
          ref('Shabbat'),
          obj({ familiesCount: int(undefined, 3), slotCounts: ref('SlotCounts') }),
        ],
      },
      SlotCounts: obj({ total: int(undefined, 9), open: int(undefined, 4), taken: int(undefined, 4), delivered: int(undefined, 1) }),
      Slot: obj(
        {
          id: int(undefined, 5),
          shabbatId: int(undefined, 1),
          familyId: int(undefined, 1),
          category: CATEGORY,
          categoryLabel: str(undefined, 'תבשיל'),
          portions: int('כמות מנות', 7),
          status: enumOf(['OPEN', 'TAKEN', 'DELIVERED'], 'OPEN=פנויה, TAKEN=תפוסה, DELIVERED=נמסרה'),
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
        ['id', 'shabbatId', 'familyId', 'category', 'portions', 'status'],
      ),
      BoardSlot: obj(
        {
          id: int('מזהה המשבצת – נשלח ב-POST /api/assignments', 5),
          category: CATEGORY,
          categoryLabel: str(undefined, 'תבשיל'),
          portions: int(undefined, 7),
          status: enumOf(['OPEN', 'TAKEN', 'DELIVERED']),
          productName: nullable(str('במשבצת תפוסה – איזה מוצר נבחר', 'עוף בתנור')),
          isMine: bool('האם המשבצת שלי'),
        },
        ['id', 'category', 'categoryLabel', 'portions', 'status', 'productName', 'isMine'],
      ),
      VolunteerFamily: obj(
        {
          label: str('כינוי אנונימי', "משפחה א'"),
          peopleCount: int(undefined, 7),
          simchaType: str(undefined, 'בן'),
          dietaryNotes: nullable(str(undefined, 'ללא גלוטן')),
        },
        ['label', 'peopleCount', 'simchaType'],
      ),
      VolunteerShabbat: obj(
        {
          id: int(undefined, 1),
          shabbatDate: date(),
          parasha: str(undefined, 'נח'),
          deliveryDeadline: dateTime(),
          cancelDeadline: dateTime(),
          collectionPoint: str(),
          message: nullable(str()),
          status: enumOf(['PUBLISHED', 'CLOSED']),
          isOpenForRegistration: bool(),
        },
      ),
      CurrentBoard: obj(
        {
          shabbat: nullable(ref('VolunteerShabbat')),
          slotCounts: nullable(ref('SlotCounts')),
          families: arrayOf({ allOf: [ref('VolunteerFamily'), obj({ slots: arrayOf(ref('BoardSlot')) })] }),
        },
        ['shabbat', 'families'],
      ),
      AdminBoardAssignment: obj({
        id: int(undefined, 3),
        status: enumOf(['ACTIVE', 'DELIVERED']),
        note: nullable(str()),
        createdAt: dateTime(),
        deliveredAt: nullable(dateTime()),
        product: obj({ id: int(), name: str(undefined, 'עוף בתנור') }),
        user: obj({ id: int(), firstName: str(), lastName: str(), phone: str(), email: str() }),
      }),
      AdminBoard: obj(
        {
          shabbat: ref('Shabbat'),
          slotCounts: ref('SlotCounts'),
          families: arrayOf({
            allOf: [
              ref('Family'),
              obj({
                slots: arrayOf({ allOf: [ref('Slot'), obj({ assignment: nullable(ref('AdminBoardAssignment')) })] }),
              }),
            ],
          }),
          distributionListMessage: nullable(str('הודעה מוכנה להעתקה לרשימת התפוצה (אחרי פרסום)')),
        },
        ['shabbat', 'slotCounts', 'families'],
      ),
      Assignment: obj(
        {
          id: int(undefined, 3),
          status: enumOf(['ACTIVE', 'DELIVERED', 'CANCELLED']),
          note: nullable(str()),
          createdAt: dateTime(),
          cancelledAt: nullable(dateTime()),
          deliveredAt: nullable(dateTime()),
          canCancel: bool('האם אפשר עדיין לבטל (שיבוץ פעיל ולפני רביעי 21:00)'),
          product: obj({ id: int(), name: str(undefined, 'עוף בתנור'), category: CATEGORY }),
          slot: obj({ id: int(), category: CATEGORY, categoryLabel: str(), portions: int() }),
          family: ref('VolunteerFamily'),
          shabbat: ref('VolunteerShabbat'),
        },
        ['id', 'status', 'canCancel', 'product', 'slot', 'family', 'shabbat'],
      ),
      AdminAssignment: obj(
        {
          id: int(undefined, 3),
          slotId: int(),
          userId: int(),
          productId: int(),
          status: enumOf(['ACTIVE', 'DELIVERED', 'CANCELLED']),
          note: nullable(str()),
          createdAt: dateTime(),
          cancelledAt: nullable(dateTime()),
          deliveredAt: nullable(dateTime()),
          product: obj({ id: int(), name: str(), category: CATEGORY }),
          user: obj({ id: int(), firstName: str(), lastName: str(), email: str(), phone: str() }),
          slot: obj({ id: int(), category: CATEGORY, categoryLabel: str(), portions: int(), status: enumOf(['OPEN', 'TAKEN', 'DELIVERED']) }),
          family: obj({ id: int(), familyName: str(), peopleCount: int() }),
          shabbat: obj({ id: int(), shabbatDate: date(), parasha: str(), status: enumOf(['DRAFT', 'PUBLISHED', 'CLOSED']) }),
        },
        ['id', 'status', 'product', 'user', 'slot', 'family', 'shabbat'],
      ),
      AssignmentResult: {
        description: 'מתנדבת מקבלת Assignment, מנהלת מקבלת AdminAssignment',
        oneOf: [ref('Assignment'), ref('AdminAssignment')],
      },
      ReportSummary: obj({
        slotCounts: ref('SlotCounts'),
        familiesCount: int(undefined, 3),
        volunteersCount: int(undefined, 4),
        totalPortions: int(undefined, 54),
        familiesMissing: arrayOf(obj({ familyId: int(), familyName: str(), openCategories: arrayOf(str(undefined, 'סלט')) })),
      }),
      Dashboard: obj({
        upcomingShabbat: nullable({ allOf: [obj({ shabbat: ref('Shabbat') }), ref('ReportSummary')] }),
        pendingVolunteers: int('בקשות הצטרפות שממתינות', 1),
        activeVolunteers: int(undefined, 12),
        activeFamilies: int(undefined, 3),
      }),
      WeekReport: {
        allOf: [
          obj({ shabbat: ref('Shabbat') }),
          ref('ReportSummary'),
          obj({
            families: arrayOf(
              obj({
                familyId: int(),
                familyName: str(),
                peopleCount: int(),
                items: arrayOf(
                  obj({
                    slotId: int(),
                    category: CATEGORY,
                    categoryLabel: str(),
                    portions: int(),
                    status: enumOf(['OPEN', 'TAKEN', 'DELIVERED']),
                    productName: nullable(str()),
                    volunteer: nullable(obj({ id: int(), name: str(), phone: str() })),
                  }),
                ),
              }),
            ),
          }),
        ],
      },
      JobResult: obj({ sent: int('כמה מיילים נשלחו', 4), shabbatId: int(), message: str() }),
    },
    responses: {
      BadRequest: {
        description: 'הנתונים שנשלחו אינם תקינים',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'חלק מהנתונים שנשלחו אינם תקינים',
                details: [{ field: 'email', message: 'כתובת אימייל אינה תקינה' }],
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'אין Token, ה-Token לא תקין, פג תוקפו, או שהחשבון אינו פעיל',
        content: {
          'application/json': {
            schema: ref('Error'),
            examples: {
              missing: { summary: 'אין Token', value: { error: { code: 'TOKEN_MISSING', message: 'נדרשת התחברות' } } },
              expired: { summary: 'פג תוקף', value: { error: { code: 'TOKEN_EXPIRED', message: 'פג תוקף ההתחברות, יש להתחבר מחדש' } } },
              invalid: { summary: 'Token לא תקין', value: { error: { code: 'TOKEN_INVALID', message: 'ההתחברות אינה תקינה, יש להתחבר מחדש' } } },
            },
          },
        },
      },
      Forbidden: {
        description: 'אין הרשאה לפעולה',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: { error: { code: 'FORBIDDEN', message: 'אין לך הרשאה לבצע פעולה זו' } },
          },
        },
      },
      NotFound: {
        description: 'הרשומה לא נמצאה',
        content: { 'application/json': { schema: ref('Error'), example: { error: { code: 'NOT_FOUND', message: 'הרשומה לא נמצאה' } } } },
      },
      Conflict: {
        description: 'התנגשות עם המצב הנוכחי (למשל משבצת שנתפסה או אימייל קיים)',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: { error: { code: 'SLOT_TAKEN', message: 'המשבצת נתפסה, בחרי אחרת' } },
          },
        },
      },
      TooManyRequests: {
        description: 'יותר מדי ניסיונות',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: { error: { code: 'TOO_MANY_REQUESTS', message: 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות' } },
          },
        },
      },
      ServiceUnavailable: {
        description: 'השירות לא הוגדר בשרת',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: { error: { code: 'CRON_NOT_CONFIGURED', message: 'המשימות המתוזמנות לא הוגדרו בשרת (חסר CRON_SECRET)' } },
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: op({
        tag: 'כללי',
        summary: 'בדיקת בריאות',
        description: 'מחזיר 200 כשהשרת ומסד הנתונים פועלים, ו-503 כשמסד הנתונים לא זמין.',
        auth: 'public',
        success: {
          description: 'השרת תקין',
          schema: obj({ status: str(undefined, 'ok'), database: str(undefined, 'ok'), time: dateTime() }),
          example: { status: 'ok', database: 'ok', time: '2026-10-15T18:00:00.000Z' },
        },
      }),
    },

    // ---------- התחברות ----------
    '/api/auth/register': {
      post: op({
        tag: 'התחברות',
        summary: 'בקשת הצטרפות',
        description: 'יוצר חשבון מתנדבת בסטטוס PENDING. אי אפשר להתחבר עד שהמנהלת מאשרת. נשלח מייל למנהלת.',
        auth: 'public',
        body: {
          schema: obj(
            {
              firstName: { type: 'string', minLength: 2, maxLength: 50 },
              lastName: { type: 'string', minLength: 2, maxLength: 50 },
              phone: str('טלפון ישראלי'),
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8, description: 'לפחות 8 תווים, אות אחת וספרה אחת' },
              address: nullable({ type: 'string', maxLength: 200 }),
            },
            ['firstName', 'lastName', 'phone', 'email', 'password'],
          ),
          example: {
            firstName: 'מרים',
            lastName: 'פרץ',
            phone: '054-1112233',
            email: 'miriam@example.com',
            password: 'Miriam123',
          },
        },
        success: {
          status: 201,
          description: 'הבקשה נשלחה',
          schema: obj({ message: str(), user: ref('User') }),
          example: { message: 'בקשת ההצטרפות נשלחה. החשבון ייפתח לאחר אישור המנהלת', user: { ...exUser, status: 'PENDING' } },
        },
        errors: [409, 429],
      }),
    },
    '/api/auth/login': {
      post: op({
        tag: 'התחברות',
        summary: 'התחברות',
        description:
          'מחזיר JWT ופרטי המשתמשת. רק חשבון פעיל יכול להתחבר: חשבון ממתין מקבל 403 ACCOUNT_PENDING, ומושבת 403 ACCOUNT_INACTIVE. אימייל או סיסמה שגויים → 401 INVALID_CREDENTIALS.\n\n' +
          'משתמשות לדוגמה (אחרי הרצת ה-seed בסביבת פיתוח): מנהלת `admin@example.com` / `Admin123!`, מתנדבת `sara@example.com` / `Volunteer123!`.',
        auth: 'public',
        body: {
          schema: obj({ email: { type: 'string', format: 'email' }, password: str() }, ['email', 'password']),
          example: { email: 'admin@example.com', password: 'Admin123!' },
        },
        success: {
          description: 'התחברות הצליחה',
          schema: obj(
            { token: str('JWT'), tokenType: str(undefined, 'Bearer'), expiresIn: str('תוקף', '7d'), user: ref('User') },
            ['token', 'tokenType', 'expiresIn', 'user'],
          ),
          example: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', tokenType: 'Bearer', expiresIn: '7d', user: { ...exUser, id: 1, firstName: 'רחל', lastName: 'אברהם', email: 'admin@example.com', role: 'ADMIN' } },
        },
        errors: [401, 403, 429],
      }),
    },
    '/api/auth/me': {
      get: op({
        tag: 'התחברות',
        summary: 'פרטי המשתמשת המחוברת',
        description: 'שימושי בטעינת האתר: אם ה-Token עדיין תקין – מחזיר את המשתמשת (כולל role), אחרת 401.',
        auth: 'user',
        success: { description: 'פרטי המשתמשת', schema: ref('User'), example: exUser },
      }),
    },
    '/api/auth/forgot-password': {
      post: op({
        tag: 'התחברות',
        summary: 'שכחתי סיסמה',
        description:
          'שולח מייל עם קישור לאיפוס (תקף לשעה) אל `CLIENT_URL/reset-password?token=...`. התשובה תמיד זהה – כדי שלא יהיה אפשר לגלות אילו כתובות רשומות.',
        auth: 'public',
        body: { schema: obj({ email: { type: 'string', format: 'email' } }, ['email']), example: { email: 'sara@example.com' } },
        success: {
          description: 'הבקשה התקבלה',
          schema: ref('Message'),
          example: { message: 'אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה' },
        },
        errors: [429],
      }),
    },
    '/api/auth/reset-password': {
      post: op({
        tag: 'התחברות',
        summary: 'קביעת סיסמה חדשה',
        description: 'מקבל את ה-token מהקישור שבמייל ואת הסיסמה החדשה. קוד לא תקין או שפג תוקפו → 400 RESET_TOKEN_INVALID.',
        auth: 'public',
        body: {
          schema: obj({ token: str('64 תווים מהקישור'), password: { type: 'string', minLength: 8 } }, ['token', 'password']),
          example: { token: 'a3f1c2...64 תווים', password: 'NewPass123' },
        },
        success: { description: 'הסיסמה עודכנה', schema: ref('Message'), example: { message: 'הסיסמה עודכנה. אפשר להתחבר עם הסיסמה החדשה' } },
        errors: [429],
      }),
    },

    // ---------- משתמשות ----------
    '/api/users/me': {
      put: op({
        tag: 'משתמשות',
        summary: 'עדכון הפרופיל שלי',
        description: 'שולחים רק את השדות שמשתנים. כדי להסיר את עצמך מרשימת המיילים: `{ "receiveWeeklyEmail": false }`. אי אפשר לשנות כאן אימייל, תפקיד או סטטוס.',
        auth: 'user',
        body: {
          schema: obj({
            firstName: { type: 'string', minLength: 2, maxLength: 50 },
            lastName: { type: 'string', minLength: 2, maxLength: 50 },
            phone: str(),
            address: nullable(str()),
            receiveWeeklyEmail: bool(),
          }),
          example: { phone: '052-9998877', receiveWeeklyEmail: false },
        },
        success: { description: 'הפרופיל המעודכן', schema: ref('User'), example: { ...exUser, phone: '0529998877', receiveWeeklyEmail: false } },
      }),
    },
    '/api/users/me/password': {
      put: op({
        tag: 'משתמשות',
        summary: 'שינוי סיסמה',
        description: 'סיסמה נוכחית שגויה → 400 WRONG_PASSWORD.',
        auth: 'user',
        body: {
          schema: obj({ currentPassword: str(), newPassword: { type: 'string', minLength: 8 } }, ['currentPassword', 'newPassword']),
          example: { currentPassword: 'Volunteer123!', newPassword: 'MyNewPass456' },
        },
        success: { description: 'הסיסמה עודכנה', schema: ref('Message'), example: { message: 'הסיסמה עודכנה בהצלחה' } },
      }),
    },
    '/api/users': {
      get: op({
        tag: 'משתמשות',
        summary: 'רשימת מתנדבות',
        description: 'כולל חיפוש, סינון לפי סטטוס (למשל PENDING לבקשות ממתינות), מיון ועמודים. לכל מתנדבת מוחזר assignmentsCount.',
        auth: 'admin',
        query: [
          q('q', { type: 'string' }, 'חיפוש בשם, אימייל או טלפון'),
          q('status', enumOf(['PENDING', 'ACTIVE', 'INACTIVE']), 'סינון לפי סטטוס'),
          q('sortBy', { ...enumOf(['firstName', 'lastName', 'createdAt']), default: 'createdAt' }, 'שדה למיון'),
          q('order', { ...enumOf(['asc', 'desc']), default: 'desc' }, 'כיוון המיון'),
          ...pageParams,
        ],
        success: {
          description: 'רשימה בעמודים',
          schema: paginated('VolunteerListItem'),
          example: { items: [{ ...exUser, notes: null, assignmentsCount: 4 }], total: 1, page: 1, pageSize: 20, totalPages: 1 },
        },
      }),
      post: op({
        tag: 'משתמשות',
        summary: 'הוספת מתנדבת ישירות',
        description: 'יוצר מתנדבת פעילה. אם לא נשלחה סיסמה – נשלח לה מייל עם קישור לבחירת סיסמה (תקף 72 שעות).',
        auth: 'admin',
        body: {
          schema: obj(
            {
              firstName: str(),
              lastName: str(),
              phone: str(),
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8, description: 'רשות' },
              address: nullable(str()),
              notes: nullable(str()),
              receiveWeeklyEmail: { type: 'boolean', default: true },
            },
            ['firstName', 'lastName', 'phone', 'email'],
          ),
          example: { firstName: 'חנה', lastName: 'מזרחי', phone: '050-3334455', email: 'hana@example.com' },
        },
        success: {
          status: 201,
          description: 'המתנדבת נוצרה',
          schema: obj({ user: ref('AdminUser'), inviteEmailSent: bool('האם נשלח מייל הזמנה') }),
          example: { user: { ...exUser, id: 7, firstName: 'חנה', lastName: 'מזרחי', email: 'hana@example.com', notes: null }, inviteEmailSent: true },
        },
        errors: [409],
      }),
    },
    '/api/users/{id}': {
      get: op({
        tag: 'משתמשות',
        summary: 'פרטי מתנדבת והשיבוצים שלה',
        auth: 'admin',
        path: [idPath('מזהה המתנדבת')],
        success: {
          description: 'פרטי המתנדבת ו-50 השיבוצים האחרונים שלה',
          schema: { allOf: [ref('AdminUser'), obj({ assignments: arrayOf(obj({})) })] },
        },
        errors: [404],
      }),
      patch: op({
        tag: 'משתמשות',
        summary: 'אישור / השבתה / עריכת מתנדבת',
        description: 'לאישור בקשת הצטרפות: `{ "status": "ACTIVE" }` (נשלח למתנדבת מייל). להשבתה: `{ "status": "INACTIVE" }`. אי אפשר להשבית את המנהלת.',
        auth: 'admin',
        path: [idPath('מזהה המתנדבת')],
        body: {
          schema: obj({
            status: enumOf(['PENDING', 'ACTIVE', 'INACTIVE']),
            firstName: str(),
            lastName: str(),
            phone: str(),
            address: nullable(str()),
            notes: nullable(str()),
            receiveWeeklyEmail: bool(),
          }),
          example: { status: 'ACTIVE' },
        },
        success: { description: 'המתנדבת המעודכנת', schema: ref('AdminUser') },
        errors: [404],
      }),
    },

    // ---------- משפחות ----------
    '/api/families': {
      get: op({
        tag: 'משפחות',
        summary: 'רשימת משפחות',
        auth: 'admin',
        query: [
          q('q', { type: 'string' }, 'חיפוש בשם, כתובת או סוג שמחה'),
          q('status', enumOf(['ACTIVE', 'FINISHED']), 'פעילות או שסיימו'),
          q('sortBy', { ...enumOf(['familyName', 'createdAt', 'firstShabbat', 'peopleCount']), default: 'createdAt' }, 'שדה למיון'),
          q('order', { ...enumOf(['asc', 'desc']), default: 'desc' }, 'כיוון המיון'),
          ...pageParams,
        ],
        success: {
          description: 'רשימה בעמודים',
          schema: paginated('Family'),
          example: { items: [exFamily], total: 1, page: 1, pageSize: 20, totalPages: 1 },
        },
      }),
      post: op({
        tag: 'משפחות',
        summary: 'הוספת משפחה',
        auth: 'admin',
        body: {
          schema: ref('FamilyInput'),
          example: {
            familyName: 'משפחת לוי',
            contactPhone: '052-7654321',
            address: 'רחוב השלום 12',
            peopleCount: 7,
            simchaType: 'בן',
            firstShabbat: '2026-10-17',
            lastShabbat: '2026-11-07',
            dietaryNotes: 'ללא גלוטן לאחד הילדים',
            deliveryNotes: 'להשאיר ליד הדלת',
          },
        },
        success: { status: 201, description: 'המשפחה נוספה', schema: ref('Family'), example: exFamily },
      }),
    },
    '/api/families/{id}': {
      get: op({
        tag: 'משפחות',
        summary: 'פרטי משפחה',
        description: 'כולל את המשבצות של המשפחה בשבתות האחרונות ומי שובצה לכל אחת.',
        auth: 'admin',
        path: [idPath('מזהה המשפחה')],
        success: { description: 'פרטי המשפחה', schema: { allOf: [ref('Family'), obj({ slots: arrayOf(obj({})) })] } },
        errors: [404],
      }),
      put: op({
        tag: 'משפחות',
        summary: 'עריכת משפחה',
        description: 'שולחים רק את השדות שמשתנים (כל שדות FamilyInput, וגם status).',
        auth: 'admin',
        path: [idPath('מזהה המשפחה')],
        body: { schema: { allOf: [ref('FamilyInput')], description: 'כל השדות רשות' }, example: { peopleCount: 8, lastShabbat: '2026-11-14' } },
        success: { description: 'המשפחה המעודכנת', schema: ref('Family') },
        errors: [404],
      }),
      delete: op({
        tag: 'משפחות',
        summary: 'סיום סיוע למשפחה',
        description: 'לא מוחק את המשפחה – משנה את הסטטוס ל-FINISHED. ההיסטוריה נשמרת.',
        auth: 'admin',
        path: [idPath('מזהה המשפחה')],
        success: { description: 'המשפחה עם status=FINISHED', schema: ref('Family') },
        errors: [404],
      }),
    },

    // ---------- מוצרים ----------
    '/api/products': {
      get: op({
        tag: 'מוצרים',
        summary: 'רשימת מוצרים',
        description: 'מתנדבת רואה רק מוצרים פעילים. מנהלת יכולה להוסיף `includeInactive=true`. לחלון ההרשמה למשבצת – לסנן לפי category של המשבצת.',
        auth: 'user',
        query: [
          q('category', CATEGORY, 'סינון לפי קטגוריה'),
          q('q', { type: 'string' }, 'חיפוש לפי שם'),
          q('includeInactive', enumOf(['true', 'false']), 'מנהלת בלבד: לכלול מוצרים מושבתים'),
        ],
        success: { description: 'רשימת מוצרים', schema: arrayOf(ref('Product')), example: [exProduct] },
      }),
      post: op({
        tag: 'מוצרים',
        summary: 'הוספת מוצר',
        description: 'שם המוצר ייחודי בתוך הקטגוריה (409 PRODUCT_EXISTS).',
        auth: 'admin',
        body: { schema: ref('ProductInput'), example: { name: 'קציצות ברוטב', category: 'MAIN', description: 'קציצות בקר ברוטב עגבניות' } },
        success: { status: 201, description: 'המוצר נוסף', schema: ref('Product') },
        errors: [409],
      }),
    },
    '/api/products/{id}': {
      put: op({
        tag: 'מוצרים',
        summary: 'עריכת מוצר',
        description: 'שולחים רק את השדות שמשתנים. אפשר גם להחזיר מוצר מושבת: `{ "isActive": true }`.',
        auth: 'admin',
        path: [idPath('מזהה המוצר')],
        body: {
          schema: obj({ name: str(), category: CATEGORY, description: nullable(str()), isActive: bool() }),
          example: { description: 'עוף בתנור עם תפוחי אדמה ובצל' },
        },
        success: { description: 'המוצר המעודכן', schema: ref('Product') },
        errors: [404, 409],
      }),
      delete: op({
        tag: 'מוצרים',
        summary: 'השבתת מוצר',
        description: 'לא מוחק – משנה isActive ל-false. המוצר לא יוצג לבחירה, אבל נשאר בשיבוצים קודמים.',
        auth: 'admin',
        path: [idPath('מזהה המוצר')],
        success: { description: 'המוצר עם isActive=false', schema: ref('Product') },
        errors: [404],
      }),
    },

    // ---------- שבתות ----------
    '/api/shabbatot/current': {
      get: op({
        tag: 'שבתות',
        summary: 'לוח השבוע (דף הבית של המתנדבת)',
        description:
          'השבת המפורסמת הקרובה וכל המשבצות שלה. **פרטי המשפחה הפרטיים לא נשלחים** – רק כינוי ("משפחה א\'"), מספר נפשות, סוג שמחה והערות אוכל.\n\n' +
          'אם אין כרגע שבת מפורסמת – מוחזר `{ "shabbat": null, "slotCounts": null, "families": [] }`.',
        auth: 'user',
        query: [
          q('category', CATEGORY, 'הצגת משבצות מקטגוריה אחת בלבד'),
          q('onlyOpen', enumOf(['true', 'false']), 'הצגת משבצות פנויות בלבד'),
        ],
        success: {
          description: 'לוח השבוע',
          schema: ref('CurrentBoard'),
          example: {
            shabbat: exShabbatVolunteer,
            slotCounts: { total: 3, open: 2, taken: 1, delivered: 0 },
            families: [
              {
                label: "משפחה א'",
                peopleCount: 7,
                simchaType: 'בן',
                dietaryNotes: 'ללא גלוטן לאחד הילדים',
                slots: [
                  { id: 1, category: 'MAIN', categoryLabel: 'תבשיל', portions: 7, status: 'TAKEN', productName: 'עוף בתנור', isMine: true },
                  { id: 2, category: 'SALAD', categoryLabel: 'סלט', portions: 7, status: 'OPEN', productName: null, isMine: false },
                  { id: 3, category: 'DESSERT', categoryLabel: 'קינוח', portions: 7, status: 'OPEN', productName: null, isMine: false },
                ],
              },
            ],
          },
        },
      }),
    },
    '/api/shabbatot': {
      get: op({
        tag: 'שבתות',
        summary: 'רשימת כל השבתות (כולל היסטוריה)',
        auth: 'admin',
        query: [q('status', enumOf(['DRAFT', 'PUBLISHED', 'CLOSED']), 'סינון לפי סטטוס')],
        success: { description: 'שבתות, מהחדשה לישנה', schema: arrayOf(ref('ShabbatListItem')) },
      }),
      post: op({
        tag: 'שבתות',
        summary: 'יצירת שבת (טיוטה)',
        description: 'התאריך חייב להיות יום שבת ולא בעבר (400 NOT_SATURDAY / DATE_IN_PAST). שבת בתאריך קיים → 409 SHABBAT_EXISTS. מועד המסירה מחושב אוטומטית. בלי collectionPoint – נלקחת ברירת המחדל מהגדרות השרת.',
        auth: 'admin',
        body: {
          schema: obj(
            {
              shabbatDate: date(),
              parasha: { type: 'string', minLength: 2, maxLength: 50 },
              collectionPoint: nullable({ type: 'string', maxLength: 200 }),
              message: nullable({ type: 'string', maxLength: 2000 }),
            },
            ['shabbatDate', 'parasha'],
          ),
          example: { shabbatDate: '2026-10-24', parasha: 'נח', message: 'שבוע טוב לכולן!' },
        },
        success: { status: 201, description: 'השבת נוצרה בסטטוס DRAFT', schema: ref('Shabbat'), example: { ...exShabbat, status: 'DRAFT', isOpenForRegistration: false, publishedAt: null } },
        errors: [409],
      }),
    },
    '/api/shabbatot/{id}': {
      get: op({
        tag: 'שבתות',
        summary: 'הלוח המלא של שבת (מנהלת)',
        description: 'כל המשפחות (עם שמות), המשבצות, מי שובצה ומה היא מביאה. אחרי פרסום – גם distributionListMessage להעתקה.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        success: { description: 'הלוח המלא', schema: ref('AdminBoard') },
        errors: [404],
      }),
      put: op({
        tag: 'שבתות',
        summary: 'עריכת שבת',
        description: 'אפשר לערוך פרשה, דברי פתיחה ונקודת איסוף כל עוד השבת לא נסגרה. את התאריך אפשר לשנות רק בטיוטה.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        body: {
          schema: obj({ shabbatDate: date(), parasha: str(), collectionPoint: str(), message: nullable(str()) }),
          example: { message: 'השבוע חסרים בעיקר קינוחים!' },
        },
        success: { description: 'השבת המעודכנת', schema: ref('Shabbat') },
        errors: [404, 409],
      }),
      delete: op({
        tag: 'שבתות',
        summary: 'מחיקת שבת (רק טיוטה)',
        description: 'מוחק את השבת ואת המשבצות שלה. שבת שפורסמה → 409 SHABBAT_NOT_DRAFT.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        success: { status: 204, description: 'נמחקה' },
        errors: [404, 409],
      }),
    },
    '/api/shabbatot/{id}/generate-slots': {
      post: op({
        tag: 'שבתות',
        summary: 'יצירת משבצות אוטומטית',
        description:
          'יוצר משבצת לכל משפחה פעילה שהשבת בתקופת הסיוע שלה (firstShabbat–lastShabbat), לכל קטגוריה שנבחרה. ברירת מחדל: תבשיל, סלט, קינוח. כמות המנות = מספר הנפשות. משבצות שכבר קיימות לא נוצרות שוב, כך שאפשר להפעיל שוב בבטחה. גוף הבקשה רשות.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        body: {
          required: false,
          schema: obj({ categories: arrayOf(CATEGORY) }),
          example: { categories: ['MAIN', 'SALAD', 'DESSERT'] },
        },
        success: {
          status: 201,
          description: 'סיכום היצירה והלוח המעודכן',
          schema: obj({ familiesCount: int(undefined, 3), created: int(undefined, 9), skipped: int(undefined, 0), board: ref('AdminBoard') }),
        },
        errors: [404, 409],
      }),
    },
    '/api/shabbatot/{id}/publish': {
      patch: op({
        tag: 'שבתות',
        summary: 'פרסום שבת',
        description:
          'פותח את השבת להרשמה, שולח מייל לכל המתנדבות הפעילות שבחרו לקבל, ומחזיר הודעה מוכנה לרשימת התפוצה. שגיאות 409: ALREADY_PUBLISHED, NO_SLOTS, DEADLINE_PASSED.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        success: {
          description: 'השבת פורסמה',
          schema: obj({ shabbat: ref('Shabbat'), distributionListMessage: str('הודעה להעתקה לרשימת התפוצה'), emailsQueued: int('לכמה מתנדבות נשלח מייל', 12) }),
          example: {
            shabbat: exShabbat,
            distributionListMessage: "🍲 עזר ליולדת – שבת פרשת נח (24.10.2026)\n\nהשבוע 3 משפחות שמחות מחכות לארוחות שבת:\n• משפחה א' – בן, 7 נפשות\n...\nלהרשמה ולבחירת מאכל: https://ezer.example.com",
            emailsQueued: 12,
          },
        },
        errors: [404, 409],
      }),
    },
    '/api/shabbatot/{id}/close': {
      patch: op({
        tag: 'שבתות',
        summary: 'סגירת שבת ידנית',
        description: 'שבת נסגרת גם אוטומטית ביום חמישי ב-21:00. אחרי סגירה מתנדבות לא יכולות להירשם או לבטל.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        success: { description: 'השבת נסגרה', schema: ref('Shabbat') },
        errors: [404, 409],
      }),
    },

    // ---------- משבצות ----------
    '/api/slots': {
      post: op({
        tag: 'משבצות',
        summary: 'הוספת משבצת ידנית',
        description: 'למשל משבצת "סלט" נוספת למשפחה גדולה. בלי portions – נלקח מספר הנפשות של המשפחה.',
        auth: 'admin',
        body: {
          schema: obj(
            { shabbatId: int(), familyId: int(), category: CATEGORY, portions: { type: 'integer', minimum: 1, maximum: 100 } },
            ['shabbatId', 'familyId', 'category'],
          ),
          example: { shabbatId: 1, familyId: 1, category: 'SALAD', portions: 7 },
        },
        success: { status: 201, description: 'המשבצת נוספה', schema: ref('Slot') },
        errors: [404, 409],
      }),
    },
    '/api/slots/{id}': {
      put: op({
        tag: 'משבצות',
        summary: 'עריכת משבצת',
        description: 'רק משבצת פנויה (409 SLOT_NOT_OPEN) בשבת שלא נסגרה.',
        auth: 'admin',
        path: [idPath('מזהה המשבצת')],
        body: { schema: obj({ category: CATEGORY, portions: { type: 'integer', minimum: 1, maximum: 100 } }), example: { portions: 10 } },
        success: { description: 'המשבצת המעודכנת', schema: ref('Slot') },
        errors: [404, 409],
      }),
      delete: op({
        tag: 'משבצות',
        summary: 'מחיקת משבצת',
        description: 'רק משבצת פנויה בשבת שלא נסגרה.',
        auth: 'admin',
        path: [idPath('מזהה המשבצת')],
        success: { status: 204, description: 'נמחקה' },
        errors: [404, 409],
      }),
    },

    // ---------- שיבוצים ----------
    '/api/assignments': {
      post: op({
        tag: 'שיבוצים',
        summary: 'הרשמה למשבצת ("אני מביאה")',
        description:
          'המשתמשת נקבעת לפי ה-Token. המוצר חייב להיות פעיל ומאותה קטגוריה של המשבצת. ' +
          'אם המשבצת כבר נתפסה (גם אם שתי מתנדבות לחצו באותו רגע) → **409 SLOT_TAKEN**. שבת סגורה → 409 SHABBAT_CLOSED. ' +
          'אחרי הצלחה נשלח מייל אישור.\n\n**מנהלת** יכולה לשלוח גם `userId` כדי לשבץ מתנדבת ידנית (מתנדבת ששולחת userId של אחרת → 403).',
        auth: 'user',
        body: {
          schema: obj(
            {
              slotId: int('מזהה המשבצת מלוח השבוע'),
              productId: int('מזהה המוצר שנבחר'),
              note: nullable({ type: 'string', maxLength: 300 }),
              userId: int('מנהלת בלבד – שיבוץ ידני'),
            },
            ['slotId', 'productId'],
          ),
          example: { slotId: 2, productId: 4, note: 'אביא בקופסה חד פעמית' },
        },
        success: { status: 201, description: 'השיבוץ נוצר', schema: ref('AssignmentResult') },
        errors: [403, 404, 409],
      }),
      get: op({
        tag: 'שיבוצים',
        summary: 'כל השיבוצים (מעקב מנהלת)',
        auth: 'admin',
        query: [
          q('shabbatId', { type: 'integer' }, 'שיבוצים של שבת מסוימת'),
          q('userId', { type: 'integer' }, 'שיבוצים של מתנדבת מסוימת'),
          q('status', enumOf(['ACTIVE', 'DELIVERED', 'CANCELLED']), 'סינון לפי סטטוס'),
        ],
        success: { description: 'רשימת שיבוצים, מהחדש לישן', schema: arrayOf(ref('AdminAssignment')) },
      }),
    },
    '/api/assignments/mine': {
      get: op({
        tag: 'שיבוצים',
        summary: 'השיבוצים שלי',
        description: 'רק השיבוצים של המשתמשת המחוברת. לכל שיבוץ מוחזר `canCancel` – האם להציג כפתור ביטול.',
        auth: 'user',
        query: [
          q('status', enumOf(['ACTIVE', 'DELIVERED', 'CANCELLED']), 'סינון לפי סטטוס'),
          q('upcoming', enumOf(['true', 'false']), 'רק שבתות שעוד לא עברו'),
        ],
        success: {
          description: 'השיבוצים שלי',
          schema: arrayOf(ref('Assignment')),
          example: [
            {
              id: 3,
              status: 'ACTIVE',
              note: null,
              createdAt: '2026-10-19T10:00:00.000Z',
              cancelledAt: null,
              deliveredAt: null,
              canCancel: true,
              product: { id: 1, name: 'עוף בתנור', category: 'MAIN' },
              slot: { id: 1, category: 'MAIN', categoryLabel: 'תבשיל', portions: 7 },
              family: { label: "משפחה א'", peopleCount: 7, simchaType: 'בן', dietaryNotes: 'ללא גלוטן לאחד הילדים' },
              shabbat: exShabbatVolunteer,
            },
          ],
        },
      }),
    },
    '/api/assignments/{id}': {
      delete: op({
        tag: 'שיבוצים',
        summary: 'ביטול שיבוץ',
        description:
          'המשבצת חוזרת להיות פנויה, והשיבוץ נשמר בסטטוס CANCELLED. ' +
          'מתנדבת – רק שיבוץ שלה (אחרת 403 FORBIDDEN) ועד יום רביעי 21:00 (אחרת 403 CANCEL_DEADLINE_PASSED). מנהלת – כל שיבוץ בכל זמן. ' +
          'שיבוץ שכבר בוטל או נמסר → 409 ASSIGNMENT_NOT_ACTIVE.',
        auth: 'user',
        path: [idPath('מזהה השיבוץ')],
        success: { description: 'השיבוץ אחרי הביטול', schema: ref('AssignmentResult') },
        errors: [403, 404, 409],
      }),
    },
    '/api/assignments/{id}/delivered': {
      patch: op({
        tag: 'שיבוצים',
        summary: 'סימון "נמסר" / "התקבל"',
        description: 'מתנדבת – רק שיבוץ שלה. מנהלת – כל שיבוץ. גם המשבצת מסומנת DELIVERED.',
        auth: 'user',
        path: [idPath('מזהה השיבוץ')],
        success: { description: 'השיבוץ המעודכן', schema: ref('AssignmentResult') },
        errors: [403, 404, 409],
      }),
    },

    // ---------- דוחות ----------
    '/api/reports/dashboard': {
      get: op({
        tag: 'דוחות',
        summary: 'נתוני לוח הבקרה',
        description: 'השבת הקרובה (פתוחות / תפוסות / נמסרו, ואילו משפחות עדיין חסר להן), ומספרי מתנדבות ומשפחות.',
        auth: 'admin',
        success: { description: 'נתוני לוח הבקרה', schema: ref('Dashboard') },
      }),
    },
    '/api/reports/week/{id}': {
      get: op({
        tag: 'דוחות',
        summary: 'סיכום שבת',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        success: { description: 'סיכום השבת', schema: ref('WeekReport') },
        errors: [404],
      }),
    },
    '/api/reports/week/{id}/export': {
      get: op({
        tag: 'דוחות',
        summary: 'הורדת סיכום שבת כקובץ CSV',
        description: 'קובץ שנפתח באקסל עם עברית תקינה. שם הקובץ בכותרת Content-Disposition.',
        auth: 'admin',
        path: [idPath('מזהה השבת')],
        success: { description: 'קובץ CSV', schema: { type: 'string', format: 'binary' }, contentType: 'text/csv' },
        errors: [404],
      }),
    },

    // ---------- משימות מתוזמנות ----------
    '/api/jobs/thursday-reminders': {
      post: op({
        tag: 'משימות מתוזמנות',
        summary: 'תזכורת יום חמישי למתנדבות',
        description: 'להפעלה כל יום חמישי בבוקר. שולח לכל מתנדבת עם שיבוץ פעיל לשבת הקרובה מייל עם כל הפרטים. נשלח פעם אחת בלבד לכל שבת.',
        auth: 'cron',
        success: { description: 'תוצאה', schema: ref('JobResult') },
        errors: [503],
      }),
    },
    '/api/jobs/open-slots-report': {
      post: op({
        tag: 'משימות מתוזמנות',
        summary: 'דוח משבצות פתוחות למנהלת',
        description: 'להפעלה כל יום רביעי. שולח למנהלת את רשימת המשבצות שעדיין פנויות בשבת המפורסמת הקרובה. נשלח פעם אחת בלבד לכל שבת.',
        auth: 'cron',
        success: { description: 'תוצאה', schema: ref('JobResult') },
        errors: [503],
      }),
    },
  },
};
