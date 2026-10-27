# עזר ליולדת – שרת API

שרת Backend למערכת **"עזר ליולדת"** של קהילת בית השם: תיאום ארוחות שבת למשפחות שמחות.
המנהלת מפרסמת שבת, כל מתנדבת רואה מה פנוי ונרשמת בלחיצה. המשבצת נסגרת מיד, והמיילים והתזכורות יוצאים אוטומטית.

> 👋 **פעם ראשונה כאן?** התחילי בקובץ [START-HERE.md](START-HERE.md). שם יש הוראות צעד אחר צעד להעלאה ל-GitHub ולענן.
> 📘 **כותבת את צד ה-React?** כל מה שצריך לדעת על ה-API נמצא ב-[FRONTEND-API-GUIDE.md](FRONTEND-API-GUIDE.md).

---

## טכנולוגיות

| שכבה | טכנולוגיה |
|---|---|
| שרת | Node.js 22 LTS, Express 5, TypeScript (strict) |
| מסד נתונים | PostgreSQL + Prisma ORM 6 |
| ולידציה | Zod 4 (הודעות שגיאה בעברית) |
| אבטחה | JWT (HS256), bcrypt, Helmet, CORS, הגבלת ניסיונות התחברות |
| תיעוד | Swagger UI / OpenAPI 3 בכתובת `/api-docs` |
| בדיקות | Vitest + Supertest, מול PostgreSQL אמיתי |
| מיילים | Brevo (HTTP API, במסלול החינמי) |
| תזמון | cron-job.org קורא ל-`/api/jobs/*` |

## מבנה התיקיות

```
ezer-leyoledet-backend/
├── src/
│   ├── server.ts            # הפעלת השרת
│   ├── app.ts               # הגדרת Express: אבטחה, CORS, Swagger, נתיבים
│   ├── config/env.ts        # קריאה ובדיקה של משתני הסביבה
│   ├── db/prisma.ts         # חיבור למסד הנתונים
│   ├── routes/              # אילו כתובות קיימות ואילו הרשאות נדרשות
│   ├── controllers/         # קבלת הבקשה, ולידציה והחזרת תשובה
│   ├── services/            # הלוגיקה העסקית ועבודה מול המסד
│   │   ├── serializers.ts   # בדיוק אילו שדות יוצאים מהשרת (פרטיות!)
│   │   └── email/           # שליחת מיילים ותבניות
│   ├── validation/          # סכמות Zod לכל בקשה
│   ├── middleware/          # אימות Token, הרשאות, שגיאות, הגבלת קצב
│   ├── utils/               # תאריכים ושעון ישראל, הצפנה, תוויות
│   ├── docs/openapi.ts      # תיעוד Swagger
│   └── types/               # הרחבת הטיפוסים של Express
├── prisma/
│   ├── schema.prisma        # מבנה הטבלאות
│   ├── migrations/          # היסטוריית השינויים במסד
│   └── seed.ts              # נתוני הדגמה
├── tests/                   # בדיקות אוטומטיות
├── scripts/                 # יצירת docs/openapi.json
├── docs/                    # openapi.json ומסמך האפיון
├── render.yaml              # הגדרות פריסה ל-Render
├── START-HERE.md            # מדריך העלאה לאינטרנט
└── FRONTEND-API-GUIDE.md    # מדריך ה-API לצד ה-React
```

**זרימת בקשה:** `route` → `authenticate` (Token) → `requireAdmin` (הרשאה) → `controller` (ולידציה עם Zod) → `service` (לוגיקה + Prisma) → תשובת JSON. כל שגיאה בדרך מגיעה ל-`errorHandler`, שמחזיר אותה במבנה אחיד.

## הרצה במחשב

**דרישות:** Node.js 22 (או 20.19 ומעלה) ו-PostgreSQL מקומי. אפשר גם להשתמש במסד ענן כמו Neon.

```bash
npm install
cp .env.example .env           # ב-Windows: copy .env.example .env
# ערכי את .env: DATABASE_URL ו-JWT_SECRET
npm run db:migrate             # יוצר את הטבלאות
npm run db:seed                # נתוני הדגמה
npm run dev                    # http://localhost:4000
```

אחר כך אפשר לפתוח:
- http://localhost:4000/api/health – בדיקה שהשרת פועל
- http://localhost:4000/api-docs – Swagger

**משתמשות לדוגמה (פיתוח בלבד):**

| תפקיד | אימייל | סיסמה |
|---|---|---|
| מנהלת | admin@example.com | Admin123! |
| מתנדבת | sara@example.com | Volunteer123! |
| מתנדבת | rivka@example.com | Volunteer123! |
| ממתינה לאישור | leah@example.com | Volunteer123! |

**כניסה לאתר בענן:**

| תפקיד | אימייל | סיסמה |
|---|---|---|
| מנהלת | manager@example.com | Admin123! |
| מתנדבת | sara@example.com | Volunteer123! |

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | שרת פיתוח שמתעדכן אוטומטית |
| `npm run build` | Prisma generate + קומפילציה לתיקיית `dist` |
| `npm start` | הרצת הגרסה המקומפלת |
| `npm run start:prod` | לענן: migrations, seed בטוח, ואז הפעלת השרת |
| `npm run typecheck` | בדיקת טיפוסים של TypeScript |
| `npm test` | הבדיקות האוטומטיות (צריך `.env.test`, ראי למטה) |
| `npm run db:migrate` | יצירת migration אחרי שינוי ב-`schema.prisma` |
| `npm run db:deploy` | החלת migrations קיימים (בענן) |
| `npm run db:seed` | נתוני הדגמה |
| `npm run db:studio` | ממשק גרפי לצפייה בנתונים |
| `npm run openapi` | עדכון `docs/openapi.json` |

## בדיקות

הבדיקות רצות מול מסד PostgreSQL נפרד ו**מוחקות בו את כל הנתונים**. לכן שם המסד חייב לכלול את המילה `test`, אחרת הבדיקות יסרבו לרוץ.

```bash
# פעם אחת: ליצור מסד בשם ezer_test (למשל ב-pgAdmin)
cp .env.test.example .env.test   # ולעדכן את DATABASE_URL
npm test
```

הבדיקות מכסות:
- התחברות: מוצלחת ושגויה, Token חסר, משובש או שפג תוקפו
- הרשאות: 403 למתנדבת ו-401 בלי Token, בכל נתיב של מנהלת
- CRUD, ולידציה, חיפוש, סינון ומיון
- פרטיות פרטי המשפחה
- מניעת כפילויות: 10 בקשות במקביל לאותה משבצת
- מועדי הביטול והנעילה (בעזרת שעון מדומה)
- מיילים ותזכורות
- דוחות ו-CSV
- תקינות Swagger, וש"כל נתיב מתועד"
- אילוצי מסד הנתונים

## אבטחה

- סיסמאות נשמרות כ-bcrypt hash. ה-hash וקודי האיפוס לא יוצאים אף פעם מהשרת (`serializers.ts`).
- זהות המשתמשת נקבעת רק לפי ה-Token. התפקיד והסטטוס נטענים מחדש מהמסד בכל בקשה, כך שחשבון שהושבת נחסם מיד.
- כל ההרשאות נבדקות בשרת:
  - מתנדבת לא יכולה לבטל או לסמן שיבוץ של אחרת.
  - מתנדבת לא רואה שם, כתובת או טלפון של משפחה.
- מניעת כפילויות בשתי שכבות: עדכון אטומי של המשבצת (`UPDATE ... WHERE status='OPEN'`), ואינדקס ייחודי חלקי במסד (`assignments_one_live_per_slot`).
- הגבלת ניסיונות על התחברות, הרשמה ואיפוס סיסמה.
- תשובה זהה ל"שכחתי סיסמה" גם לכתובת שלא קיימת.
- קישורי איפוס חד-פעמיים, ובמסד נשמר רק hash שלהם.
- ייצוא CSV מוגן מהזרקת נוסחאות לאקסל.

## החלטות עיצוב שכדאי להכיר

- **"מחיקה" רכה:**
  - משפחה – מקבלת סטטוס FINISHED.
  - מוצר – מושבת.
  - שיבוץ – מקבל סטטוס CANCELLED.
  
  כך ההיסטוריה והדוחות נשמרים. רק שבת בטיוטה ומשבצת פנויה נמחקות באמת.
- **נעילה בלי שעון רקע:** שבת שעבר מועד המסירה שלה (חמישי 21:00 שעון ישראל) נחשבת סגורה בכל בקשה (`effectiveStatus`). זה עובד גם כששרת חינמי "נרדם".
- **מיילים לא מכשילים פעולות:** אם השליחה נכשלת, הפעולה עצמה (למשל הרשמה למשבצת) עדיין מצליחה, והתקלה נרשמת ביומן.
- **ה-seed בענן בטוח:**
  - בלי `SEED_ADMIN_*` לא נוצרת שום מנהלת.
  - אין סיסמאות קבועות.
  - נתוני הדגמה נוצרים רק במסד ריק.

## פריסה

ההוראות המלאות נמצאות ב-[START-HERE.md](START-HERE.md). בקצרה:
1. השרת עולה ל-Render (`render.yaml`).
2. מסד הנתונים נמצא ב-Neon או ב-Supabase.
3. המיילים נשלחים דרך Brevo.
4. התזכורות מופעלות מ-cron-job.org.

הפרויקט לא דורש שום שירות AI או מפתח בתשלום.
