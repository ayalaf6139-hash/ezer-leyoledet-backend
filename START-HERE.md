# 🚀 מתחילים כאן – העלאת השרת לאינטרנט

המדריך הזה מיועד למי שאף פעם לא העלתה שרת לאינטרנט. עוברים עליו לפי הסדר, שלב אחרי שלב.

**מה נעשה:**

| חלק | שירות | בשביל מה | עלות |
|---|---|---|---|
| א | GitHub | לשמור את הקוד באינטרנט | חינם |
| ב | Neon | מסד הנתונים (PostgreSQL) | חינם |
| ג | Render | להריץ את השרת | חינם |
| ד | – | לבדוק שהכול עובד | – |
| ה | – | פתרון תקלות | – |
| ו | Brevo + cron-job.org | מיילים ותזכורות (אפשר להוסיף בסוף) | חינם |

⏱️ זמן משוער: שעה עד שעה וחצי בפעם הראשונה.

> ⚠️ **הערה חשובה:** אתרים מעדכנים את העיצוב שלהם מדי פעם, ואין לי דרך לוודא איך הם נראים ברגע זה. שמות הכפתורים במדריך הם אלה שהיו נכונים בזמן הכתיבה. אם כפתור נראה קצת אחרת, חפשי כפתור עם משמעות דומה. מקומות שבהם אני פחות בטוח מסומנים ב-🔎.

> 🔐 **כלל זהב:** סיסמאות, ה-Connection String של מסד הנתונים ומפתחות (API Keys) **לא כותבים בקוד ולא מעלים ל-GitHub**. מכניסים אותם רק במסך ההגדרות של Render. שמרי אותם בקובץ פרטי במחשב או במנהל סיסמאות.

---

## חלק א – GitHub: שמירת הקוד

### 1. פתיחת חשבון
1. נכנסים ל-https://github.com ולוחצים **Sign up**.
2. ממלאים אימייל, סיסמה ושם משתמש (למשל `ayala-friedman`).
3. מאשרים את הקוד שנשלח למייל.

### 2. יצירת Repository (מאגר קוד)
1. אחרי ההתחברות לוחצים על **+** בפינה העליונה, ואז על **New repository**.
2. **Repository name:** `ezer-leyoledet-backend`
3. בוחרים **Public** (המורה צריכה לראות את הקוד) או **Private** (ואז מוסיפים את המורה כשותפה).
4. **לא** מסמנים "Add a README file", כי יש כבר README בפרויקט.
5. לוחצים **Create repository**.

### 3. חילוץ קובץ ה-ZIP
1. במחשב, לוחצים קליק ימני על קובץ ה-ZIP ובוחרים **חלץ הכל...** (Extract All).
2. נוצרת תיקייה בשם `ezer-leyoledet-backend`. בתוכה צריכים להיות `src`, `prisma`, `package.json`, `START-HERE.md` ועוד.

> 💡 אם אחרי החילוץ יש תיקייה בתוך תיקייה באותו שם, משתמשים בתיקייה **הפנימית**, זו שבה נמצא `package.json`.

### 4. העלאת הקבצים דרך הדפדפן
1. בדף ה-Repository החדש, לוחצים על הקישור **uploading an existing file**. אם הוא לא מופיע: **Add file**, ואז **Upload files**.
2. פותחים את התיקייה שחולצה, מסמנים **את כל מה שבתוכה** (Ctrl+A) וגוררים לחלון הדפדפן.
   - חשוב לגרור את **התוכן** של התיקייה ולא את התיקייה עצמה, כדי ש-`package.json` יהיה בראש ה-Repository.
   - קבצים שמתחילים בנקודה (`.gitignore`, `.env.example`, `.nvmrc`) חייבים לעלות גם הם.
3. מחכים שכל הקבצים ייטענו.
4. למטה, בתיבת **Commit changes**, כותבים: `העלאת שרת עזר ליולדת`.
5. לוחצים **Commit changes**.

> 🔎 GitHub מגביל העלאה דרך הדפדפן ל-100 קבצים בכל פעם. בפרויקט יש פחות מזה, אבל אם תופיע הודעה על כך, מעלים קודם את התיקיות `src` ו-`tests`, ובפעם השנייה את כל השאר.

### 5. בדיקה שהקבצים נמצאים ב-GitHub
בדף הראשי של ה-Repository צריך לראות:
- [ ] תיקיות: `docs`, `prisma`, `scripts`, `src`, `tests`
- [ ] קבצים: `package.json`, `package-lock.json`, `render.yaml`, `README.md`, `START-HERE.md`, `.gitignore`, `.env.example`
- [ ] בתוך `prisma` יש תיקייה `migrations`
- [ ] **אין** קובץ בשם `.env` (בלי סיומת). אם בטעות הועלה, מוחקים אותו מיד: נכנסים לקובץ, לוחצים על סמל ⋯, ואז **Delete file**.
- [ ] **אין** תיקייה `node_modules`

---

## חלק ב – Neon: מסד הנתונים

> **למה Neon ולא מסד הנתונים של Render?** מסד ה-PostgreSQL החינמי של Render נמחק אחרי 30 יום. ב-Neon המסד החינמי לא פג. המגבלות שלו: 0.5GB אחסון (הרבה יותר ממה שהפרויקט צריך), והמסד "נרדם" אחרי כמה דקות בלי שימוש ומתעורר לבד בפנייה הבאה.
> חלופה: Supabase, ראי בסוף החלק.

### 1. פתיחת חשבון
1. נכנסים ל-https://neon.com ולוחצים **Sign up**.
2. הכי פשוט: **Continue with GitHub**, עם החשבון שפתחת בחלק א.

### 2. יצירת מסד נתונים
1. אם לא נפתח מסך יצירת פרויקט אוטומטית, לוחצים **New Project**. 🔎
2. **Project name:** `ezer-leyoledet`
3. **Postgres version:** משאירים את ברירת המחדל.
4. **Region:** בוחרים **AWS Europe Central 1 (Frankfurt)**, אותו אזור שבו נריץ את השרת ב-Render, כדי שהחיבור יהיה מהיר.
5. לוחצים **Create project**.

### 3. קבלת ה-Connection String (כתובת החיבור)
1. בלוח הבקרה של הפרויקט לוחצים על **Connect**. 🔎
2. מוודאים שהמתג **Connection pooling** **כבוי**. כך מקבלים כתובת "ישירה", ש-Prisma צריכה כדי לעדכן טבלאות.
3. מעתיקים את הכתובת. היא נראית בערך כך:
   ```
   postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. אם יש בכתובת `&channel_binding=require`, אפשר להשאיר אותו.

### 4. שמירה בטוחה
- מדביקים את הכתובת בקובץ טקסט פרטי במחשב או במנהל סיסמאות.
- **לא** שולחים אותה בקבוצות, **לא** מעלים ל-GitHub ו**לא** כותבים בקוד. היא כוללת את הסיסמה של מסד הנתונים.

### 5. איך השרת מתחבר למסד?
בחלק ג נכניס את הכתובת הזו ב-Render, במשתנה בשם `DATABASE_URL`. בכל הפעלה השרת:
1. יוצר את הטבלאות אם הן עוד לא קיימות (Prisma Migrations).
2. יוצר את חשבון המנהלת (אם הגדרת אותו).
3. מתחיל לקבל בקשות.

**אין צורך ליצור טבלאות ידנית.**

<details>
<summary>חלופה: Supabase במקום Neon</summary>

1. נכנסים ל-https://supabase.com, לוחצים **Start your project** ונרשמים עם GitHub.
2. **New project**. שם: `ezer-leyoledet`. **Database Password:** בוחרים סיסמה חזקה **ושומרים אותה**. Region: Europe (Frankfurt).
3. כשהפרויקט מוכן, לוחצים **Connect** בראש העמוד. 🔎
4. בוחרים את הכתובת מסוג **Session pooler** (פורט 5432). הכתובת הישירה עובדת רק עם IPv6 ועלולה לא לעבוד מ-Render.
5. מחליפים את `[YOUR-PASSWORD]` בסיסמה שבחרת.
6. שימי לב: ב-Supabase החינמי פרויקט שלא היה בו שימוש שבוע עלול "להיות מושהה", ואז צריך להיכנס לאתר וללחוץ Restore.
</details>

---

## חלק ג – Render: הרצת השרת

> **לפני שמתחילים, שימי לב למגבלות המסלול החינמי של Render:**
> - שרת חינמי "נרדם" אחרי 15 דקות בלי פניות.
> - הפנייה הראשונה אחרי השינה לוקחת עד דקה. זה תקין, וכל השאר מהיר.
> - יש מכסה של 750 שעות בחודש, מספיק לשרת אחד שפועל כל החודש.

### 1. פתיחת חשבון
1. נכנסים ל-https://render.com ולוחצים **Get Started** (או **Sign Up**).
2. בוחרים **GitHub** ומאשרים. כך Render יוכל לראות את ה-Repository.
3. 🔎 ייתכן שתתבקשי לאמת את החשבון. Render לא אמור לחייב כרטיס אשראי לשירות חינמי. אם בכל זאת מבקשים, קראי בעיון לפני שממשיכה.

### 2. חיבור GitHub
1. בזמן היצירה (שלב 3), אם ה-Repository לא מופיע ברשימה, לוחצים **Configure account** / **Connect GitHub**. 🔎
2. ב-GitHub בוחרים **Only select repositories**, מסמנים את `ezer-leyoledet-backend` ולוחצים **Install** / **Save**.

### 3. יצירת השירות

יש שתי דרכים. **הדרך המומלצת היא Blueprint**, כי היא קוראת את הקובץ `render.yaml` וממלאת כמעט הכול לבד.

**דרך 1 – Blueprint (מומלץ):**
1. בלוח הבקרה של Render לוחצים **New**, ואז **Blueprint**. 🔎
2. בוחרים את ה-Repository `ezer-leyoledet-backend`.
3. **Blueprint Name:** `ezer-leyoledet`
4. Render יציג את השירות `ezer-leyoledet-api` ויבקש למלא את המשתנים שמסומנים בקובץ (`sync: false`). ממלאים לפי הטבלה בשלב 6.
5. לוחצים **Apply** / **Deploy Blueprint**.

**דרך 2 – Web Service ידני** (אם דרך 1 לא עבדה):
1. **New**, ואז **Web Service**.
2. בוחרים את ה-Repository `ezer-leyoledet-backend` ולוחצים **Connect**.
3. ממלאים לפי שלבים 4–6 שלמטה ולוחצים **Create Web Service** / **Deploy Web Service**.

### 4. ההגדרות הבסיסיות (בדרך הידנית)

| שדה | ערך |
|---|---|
| **Name** | `ezer-leyoledet-api` (יהיה חלק מהכתובת) |
| **Region** | Frankfurt (EU Central), כמו מסד הנתונים |
| **Branch** | `main` |
| **Root Directory** | משאירים ריק |
| **Runtime / Language** | `Node` |
| **Instance Type** | **Free** |

### 5. Build ו-Start

| שדה | ערך מדויק להעתקה |
|---|---|
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Health Check Path** (תחת Advanced) | `/api/health` |

**מה כל פקודה עושה:**
- **Build Command:** מתקינה את החבילות, יוצרת את Prisma Client (`prisma generate`) ומקמפלת את ה-TypeScript.
- **Start Command:** מריצה את Prisma Migrations (יוצרת או מעדכנת את הטבלאות), יוצרת את חשבון המנהלת אם הוגדר, ומפעילה את השרת.

### 6. משתני סביבה (Environment Variables)

במסך היצירה (או אחר כך בתפריט **Environment**) לוחצים **Add Environment Variable** ומוסיפים:

| Key (שם) | Value (ערך) | חובה? |
|---|---|---|
| `NODE_ENV` | `production` | ✅ |
| `NODE_VERSION` | `22` | ✅ |
| `DATABASE_URL` | ה-Connection String מ-Neon (חלק ב) | ✅ |
| `JWT_SECRET` | מחרוזת אקראית ארוכה, ראי למטה (בדרך Blueprint נוצרת לבד) | ✅ |
| `JWT_EXPIRES_IN` | `7d` | |
| `CORS_ORIGINS` | הכתובת של אתר ה-React. בינתיים אפשר `http://localhost:5173` | ✅ |
| `CLIENT_URL` | אותה כתובת של אתר ה-React (לקישורים במיילים) | ✅ |
| `DEFAULT_COLLECTION_POINT` | הכתובת של נקודת האיסוף של הארגון | |
| `TIMEZONE` | `Asia/Jerusalem` | |
| `SEED_ADMIN_EMAIL` | האימייל של המנהלת | ✅ בפעם הראשונה |
| `SEED_ADMIN_PASSWORD` | סיסמה חזקה למנהלת (8 תווים לפחות, אות וספרה) | ✅ בפעם הראשונה |
| `SEED_DEMO_DATA` | `true` אם רוצים נתוני הדגמה (מומלץ להצגת הפרויקט), אחרת `false` | |
| `SEED_DEMO_PASSWORD` | סיסמה למתנדבות לדוגמה (`sara@example.com` ועוד), אם `SEED_DEMO_DATA=true` | |

**איך יוצרים `JWT_SECRET`:** בדרך Blueprint, Render יוצר אותו לבד. בדרך הידנית יש ליד השדה כפתור **Generate** 🔎. אפשר גם להריץ במחשב (אם מותקן Node.js):
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> ⚠️ **לא** מגדירים `PORT`. Render קובע אותו לבד, והשרת יודע לקרוא אותו.
> 🔐 הסיסמה של המנהלת נשמרת במסד כ-Hash מוצפן. אחרי ההפעלה הראשונה אפשר למחוק את `SEED_ADMIN_PASSWORD` מ-Render. המנהלת לא תימחק.

### 7. Prisma Migrations – איך הן מופעלות?
אין צורך לעשות שום דבר ידנית. ה-Start Command (`npm run start:prod`) מריץ `prisma migrate deploy` בכל הפעלה:
- **בהפעלה הראשונה** נוצרות כל הטבלאות.
- **בהפעלות הבאות** מופיעה ביומן ההודעה `No pending migrations to apply`, וזה תקין.

### 8. Deploy (העלאה)
1. אחרי היצירה Render מתחיל לבנות לבד. רואים את זה בלשונית **Logs** / **Events**.
2. הבנייה הראשונה לוקחת בערך 3–6 דקות.
3. ביומן צריך להופיע בסוף:
   ```
   All migrations have been successfully applied.
   🌱 מריץ seed (production)...
      • נוצרה מנהלת: ...
   ✅ השרת פועל בפורט 10000 (production)
   ```
4. מספר הפורט עשוי להיות שונה – זה בסדר.
5. בראש העמוד מופיעה הכתובת של השרת, למשל `https://ezer-leyoledet-api.onrender.com`. **שמרי אותה.**
6. מעכשיו, בכל פעם שתעלי שינוי ל-GitHub, Render יבנה ויעלה גרסה חדשה לבד (Auto-Deploy).

### 9. בדיקה שהשרת פעיל
פותחים בדפדפן את `https://<הכתובת-שלך>.onrender.com/api/health` וצריך לראות:
```json
{"status":"ok","database":"ok","time":"..."}
```
אם הדף נטען לאט בפעם הראשונה, זה תקין: השרת התעורר.

---

## חלק ד – בדיקה שהכול עובד

בכל הכתובות מחליפים את `<השרת>` בכתובת שקיבלת מ-Render.

### 1. בדיקת בריאות
פותחים `https://<השרת>/api/health`. צריך להופיע `"status":"ok"`.

### 2. פתיחת Swagger
פותחים `https://<השרת>/api-docs`. נפתח דף עם כל ה-API, מחולק לנושאים (התחברות, משפחות, שבתות...).

### 3. התחברות מתוך Swagger
1. לוחצים על הקבוצה **התחברות**, ואז על `POST /api/auth/login`.
2. לוחצים **Try it out**.
3. בתיבה מחליפים את הדוגמה בפרטי המנהלת שהגדרת:
   ```json
   { "email": "האימייל-מ-SEED_ADMIN_EMAIL", "password": "הסיסמה-מ-SEED_ADMIN_PASSWORD" }
   ```
4. לוחצים **Execute**.

### 4. קבלת ה-JWT
ב-**Response body** מופיע `"token": "eyJhbGciOi..."`. מעתיקים את כל הערך שבין המירכאות, בלי המירכאות עצמן.

### 5. שימוש ב-Authorize
1. גוללים לראש הדף ולוחצים על הכפתור הירוק **Authorize** 🔓.
2. מדביקים את ה-Token בשדה **Value**. רק את ה-Token, בלי המילה Bearer.
3. לוחצים **Authorize**, ואז **Close**. המנעולים בדף נסגרים 🔒.

### 6. קריאה ל-Endpoint מוגן
1. פותחים `GET /api/auth/me`, לוחצים **Try it out** ואז **Execute**.
2. צריך לקבל **200** עם פרטי המנהלת.

**בדיקת 401:** לוחצים שוב על **Authorize**, ואז **Logout**, ומריצים שוב את `GET /api/auth/me`. התוצאה צריכה להיות **401** עם `TOKEN_MISSING`.

**בדיקת 403:** מתחברים כמתנדבת. אם הגדרת `SEED_DEMO_DATA=true`, המתנדבת היא `sara@example.com` עם הסיסמה מ-`SEED_DEMO_PASSWORD`. שמים את ה-Token שלה ב-Authorize ומריצים `GET /api/families`. התוצאה צריכה להיות **403** עם `FORBIDDEN`.

### 7. הוספת רשומה
מחוברות כמנהלת, פותחים `POST /api/families`, לוחצים **Try it out** (הדוגמה כבר ממולאת) ואז **Execute**. צריך לקבל **201** עם המשפחה החדשה ומספר `id`.

### 8. שליפת הרשומה ממסד הנתונים
1. פותחים `GET /api/families` ולוחצים **Execute**. המשפחה החדשה מופיעה ברשימה, כלומר היא נשמרה במסד הנתונים.
2. אפשר גם לראות אותה ישירות ב-Neon: בתפריט **Tables** 🔎, בטבלה `families`.

🎉 אם כל השלבים עברו, השרת באוויר ועובד!

---

## חלק ה – פתרון תקלות

| התקלה | איך היא נראית | הפתרון |
|---|---|---|
| **Build Failed** | ב-Logs: `npm ERR!` או `error TS...` | בודקים שה-Build Command הוא בדיוק `npm ci --include=dev && npm run build`. בודקים ש-`package.json` ו-`package-lock.json` נמצאים **בראש** ה-Repository ולא בתוך תיקייה נוספת. אם הם בתוך תיקייה, ממלאים את שמה ב-**Root Directory**. |
| **`npm ci` נכשל** | `package-lock.json` חסר או לא תואם | מוודאים ש-`package-lock.json` הועלה ל-GitHub. |
| **DATABASE_URL שגוי** | `P1001: Can't reach database server` או `P1000: Authentication failed` | מעתיקים מחדש את הכתובת מ-Neon, בלי רווחים ובלי מירכאות. בודקים שהיא מתחילה ב-`postgresql://` ומסתיימת ב-`sslmode=require`. ב-Supabase: בודקים ש-`[YOUR-PASSWORD]` הוחלף בסיסמה ושנבחר Session pooler. |
| **בעיית Prisma / Migrations** | `P3009` (migration שנכשל), או `P1017` | ב-Neon בודקים שה-Connection pooling כבוי בכתובת. אם migration נכשל באמצע במסד חדש, הכי פשוט ליצור פרויקט Neon חדש ולעדכן `DATABASE_URL`. |
| **JWT_SECRET חסר** | ביומן: `❌ הגדרות סביבה לא תקינות: JWT_SECRET...` והשרת לא עולה | מוסיפים `JWT_SECRET` באורך 32 תווים לפחות ב-Environment, ושומרים. Render יפעיל מחדש לבד. |
| **משתנה אחר חסר או שגוי** | אותה הודעה עם שם המשתנה | ההודעה ביומן אומרת בדיוק מה חסר. מתקנים ב-Environment. |
| **שגיאת CORS** | בדפדפן, בקונסול של ה-React: `blocked by CORS policy` | ב-`CORS_ORIGINS` כותבים את הכתובת **המדויקת** של אתר ה-React, עם `https://` ובלי `/` בסוף. כמה כתובות מפרידים בפסיק, למשל `http://localhost:5173,https://my-app.onrender.com`. |
| **401 Unauthorized** | `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | **MISSING:** לא נשלחה כותרת `Authorization: Bearer <token>`. **INVALID:** ה-Token הועתק חלקית, או ש-`JWT_SECRET` השתנה אחרי ההתחברות. **EXPIRED:** עברו 7 ימים. בכל המקרים מתחברים מחדש. |
| **403 Forbidden** | `FORBIDDEN` | התחברת כמתנדבת ופנית לנתיב של מנהלת, וזה תקין. כדי לבצע את הפעולה מתחברים כמנהלת. |
| **403 בהתחברות** | `ACCOUNT_PENDING` | החשבון ממתין לאישור. המנהלת מאשרת ב-`PATCH /api/users/{id}` עם `{"status":"ACTIVE"}`. |
| **אי אפשר להתחבר כמנהלת** | `INVALID_CREDENTIALS` | בודקים ש-`SEED_ADMIN_EMAIL` ו-`SEED_ADMIN_PASSWORD` הוגדרו **לפני** ההפעלה, ושביומן מופיע "נוצרה מנהלת". אם הוגדרו אחר כך: **Manual Deploy**, ואז **Restart service**. |
| **Swagger לא נפתח** | דף ריק או שגיאה | בודקים את הכתובת: `/api-docs` (עם מקף). בודקים שהשרת פעיל (`/api/health`). בפעם הראשונה מחכים דקה עד שהשרת מתעורר. |
| **השרת לא עולה** | ב-Logs: `Exited with status 1`, או Health check נכשל | קוראים את השורות האחרונות ביומן, שם כתוב מה הבעיה (בדרך כלל משתנה סביבה או מסד נתונים). בודקים שה-Start Command הוא `npm run start:prod` ושלא הוגדר `PORT`. |
| **הדף נטען לאט מאוד** | הפנייה הראשונה לוקחת 30–60 שניות | זה תקין במסלול החינמי: השרת התעורר משינה. |
| **מיילים לא מגיעים** | ביומן: `📧 [מייל לא נשלח – אין BREVO_API_KEY]` | לא הוגדרו `BREVO_API_KEY` ו-`EMAIL_FROM`, ראי חלק ו. אם הוגדרו: בודקים בתיקיית הספאם, ושכתובת השולחת אומתה ב-Brevo. |

**איפה רואים את היומן?** ב-Render, בשירות `ezer-leyoledet-api`, בלשונית **Logs**.

---

## חלק ו – מיילים ותזכורות אוטומטיות

השרת עובד גם בלי החלק הזה, אבל המיילים לא יישלחו באמת, רק יירשמו ביומן. מומלץ לעשות אותו אחרי שחלקים א–ד עובדים.

> **למה Brevo?** המסלול החינמי של Render חוסם שליחת מיילים בדרך הרגילה (SMTP). Brevo שולח מיילים דרך HTTP, וזה לא חסום. במסלול החינמי שלו אפשר לשלוח עד 300 מיילים ביום.

### ו-1. Brevo – מפתח לשליחת מיילים
1. נכנסים ל-https://www.brevo.com ולוחצים **Sign up free**. מאמתים את המייל וממלאים פרטים בסיסיים.
2. **אימות הכתובת השולחת:** בתפריט (סמל המשתמש או ההגדרות) נכנסים ל-**Senders, Domains & Dedicated IPs**, ואז **Senders**, ואז **Add sender** 🔎.
   - כותבים את כתובת המייל של הארגון (למשל כתובת Gmail של "עזר ליולדת").
   - Brevo שולח לכתובת הזו מייל אימות. פותחים אותו ומאשרים.
3. **יצירת מפתח:** **SMTP & API**, ואז לשונית **API Keys**, ואז **Generate a new API key** 🔎.
   - שם: `ezer-leyoledet`.
   - מעתיקים את המפתח (מתחיל ב-`xkeysib-`). הוא מוצג **פעם אחת בלבד**, אז שומרים אותו בקובץ הפרטי.
4. ב-Render, בלשונית **Environment**, מוסיפים:

   | Key | Value |
   |---|---|
   | `BREVO_API_KEY` | המפתח שהעתקת |
   | `EMAIL_FROM` | הכתובת שאימתת בשלב 2 |
   | `EMAIL_FROM_NAME` | `עזר ליולדת` |

5. שומרים (**Save Changes**). Render מפעיל מחדש לבד.

> 💡 מיילים שנשלחים מכתובת Gmail דרך שירות חיצוני עלולים להגיע לספאם, לפחות בהתחלה. בקשי מכמה מתנדבות לסמן את המייל הראשון "לא ספאם". 🔎 Brevo עשוי להציע "לאמת דומיין". זה דורש דומיין פרטי, ולא חובה לפרויקט.

### ו-2. cron-job.org – תזכורות בזמן קבוע
השרת החינמי "נרדם", ולכן לא יכול לשלוח תזכורות בעצמו. במקום זה, האתר cron-job.org פונה לשרת בשעה קבועה, מעיר אותו, והשרת שולח את המיילים.

**הקוד הסודי:**
- ב-Render, בלשונית **Environment**, מוצאים את `CRON_SECRET`. בדרך Blueprint הוא נוצר לבד.
- בדרך הידנית מוסיפים אותו בעצמכן: מחרוזת אקראית של 16 תווים לפחות.
- מעתיקים את הערך.

**יצירת המשימות:**
1. נכנסים ל-https://cron-job.org ולוחצים **Sign up**. החשבון חינמי.
2. **Create cronjob** 🔎, ויוצרים **שלוש** משימות:

| כותרת (Title) | URL | מתי (Schedule) |
|---|---|---|
| השכמת השרת | `https://<השרת>/api/health` | כל יום חמישי 07:55 **וגם** כל יום רביעי 17:55 |
| תזכורת חמישי | `https://<השרת>/api/jobs/thursday-reminders` | כל יום חמישי 08:00 |
| דוח משבצות פתוחות | `https://<השרת>/api/jobs/open-slots-report` | כל יום רביעי 18:00 |

3. **אזור זמן:** בהגדרות המשימה בוחרים `Asia/Jerusalem` 🔎.
4. **בשתי המשימות של `/api/jobs/...`** (לא במשימת ההשכמה), בלשונית **Advanced**:
   - **Request method:** `POST`
   - **Headers:** מוסיפים כותרת בשם `X-Cron-Secret` עם הערך של `CRON_SECRET`.
   - 🔎 אם אין אפשרות להוסיף כותרת, אפשר להוסיף את הקוד לכתובת עצמה: `https://<השרת>/api/jobs/thursday-reminders?secret=<הקוד>`.
5. שומרים (**Create**).

> **למה צריך את משימת ההשכמה?** אם השרת ישן, הוא צריך עד דקה כדי להתעורר. cron-job.org עלול לוותר לפני זה. הפנייה ל-`/api/health` חמש דקות קודם מעירה אותו, ואז התזכורת עוברת מהר.

**בדיקה:** בדף המשימה ב-cron-job.org יש כפתור **Test run** / **Execute now** 🔎. אחרי ההרצה, תשובה כמו `{"sent":0,"message":"אין שבת שמחכה לתזכורת..."}` אומרת שהחיבור עובד. זה תקין כשאין כרגע שבת בתאריך המתאים. תשובת **401** אומרת שהקוד הסודי שגוי.

> כל תזכורת נשלחת **פעם אחת בלבד** לכל שבת, כך שגם אם cron-job.org יפעיל את המשימה פעמיים, לא יישלחו מיילים כפולים.

---

## נספח – הרצת השרת במחשב (לא חובה)

אם רוצים לפתח או לבדוק במחשב, צריך:
1. להתקין Node.js 22 מהאתר https://nodejs.org (גרסת LTS).
2. להתקין PostgreSQL, או להשתמש בכתובת של Neon.
3. בתיקיית הפרויקט, בטרמינל:
   ```bash
   npm install
   copy .env.example .env        # ואז לערוך את .env: DATABASE_URL ו-JWT_SECRET
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```
4. לפתוח http://localhost:4000/api-docs ולהתחבר עם `admin@example.com` / `Admin123!`.

פרטים נוספים ב-[README.md](README.md). להתחברות מצד ה-React: [FRONTEND-API-GUIDE.md](FRONTEND-API-GUIDE.md).
