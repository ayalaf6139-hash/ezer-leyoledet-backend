# 📘 מדריך ה-API לצד ה-React

המסמך מסביר **איך אתר ה-React מדבר עם השרת**: לאיזו כתובת פונים, מה שולחים, מה חוזר ואילו שגיאות יכולות להגיע.
אין כאן קוד React. את הקומפוננטות, ה-Hooks, הטפסים, ה-Routing ו-React Query כותבים בעצמך.

> 💡 הכי נוח לעבוד עם המסמך הזה פתוח לצד **Swagger** (`/api-docs`). שם אפשר לנסות כל קריאה ולראות את התשובה האמיתית לפני שכותבים קוד.

---

## 1. כתובת השרת (Base URL)

| סביבה | Base URL |
|---|---|
| במחשב | `http://localhost:4000` |
| בענן | `https://<שם-השירות>.onrender.com` (הכתובת שקיבלת מ-Render) |

**המלצה:** לא לכתוב את הכתובת בתוך הקוד, אלא לשמור אותה במשתנה סביבה של Vite, למשל `VITE_API_URL` בקובץ `.env` של פרויקט ה-React. כך מחליפים בין מחשב לענן בלי לשנות קוד.

כל הנתיבים מתחילים ב-`/api`. לדוגמה: `https://ezer-leyoledet-api.onrender.com/api/auth/login`.

> ⏳ שרת חינמי "נרדם", והקריאה הראשונה אחרי שינה יכולה לקחת עד דקה. זו עוד סיבה טובה להציג Loading.

---

## 2. איך עובדת ההתחברות (Authentication)

1. המשתמשת ממלאת אימייל וסיסמה, והאתר שולח `POST /api/auth/login`.
2. השרת בודק את הפרטים ומחזיר **Token** (מחרוזת ארוכה מסוג JWT) ואת פרטי המשתמשת, כולל `role`.
3. האתר שומר את ה-Token. בדרך כלל ב-`localStorage`, כדי שההתחברות תישאר גם אחרי רענון.
4. **בכל קריאה לנתיב מוגן** האתר שולח את ה-Token בכותרת (Header):
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   המילה `Bearer`, רווח, ואחריו ה-Token.
5. השרת מזהה מי המשתמשת **רק לפי ה-Token**. לכן לא שולחים `userId` בבקשות: השרת יודע לבד מי את.
6. ה-Token תקף ל-**7 ימים**. אחר כך השרת מחזיר `401` עם `TOKEN_EXPIRED`, וצריך להתחבר מחדש.

**בטעינת האתר:** אם יש Token שמור, קוראים ל-`GET /api/auth/me`.
- `200` → המשתמשת מחוברת. מקבלים את הפרטים שלה ואת ה-`role`.
- `401` → ה-Token לא תקף. מוחקים אותו ומעבירים לדף הכניסה.

**התנתקות:** פשוט מוחקים את ה-Token מהאתר. אין קריאה לשרת.

**איך יודעים מה להציג?** לפי `user.role`:
- `ADMIN` → מסכי מנהלת.
- `VOLUNTEER` → מסכי מתנדבת.

> ⚠️ הסתרת כפתורים ב-React היא רק לנוחות. ההגנה האמיתית נמצאת בשרת: גם אם מתנדבת תנסה לפנות לנתיב של מנהלת, היא תקבל 403.

---

## 3. מבנה התשובות

### הצלחה
- **אובייקט אחד** (למשל משפחה): מוחזר ישירות.
- **רשימה עם עמודים** (מתנדבות, משפחות):
  ```json
  { "items": [ ... ], "total": 42, "page": 1, "pageSize": 20, "totalPages": 3 }
  ```
- **רשימה פשוטה** (מוצרים, שבתות, שיבוצים): מערך `[ ... ]`.
- **מחיקה** (`204`): אין גוף תשובה.

### שגיאה – תמיד באותו מבנה
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "חלק מהנתונים שנשלחו אינם תקינים",
    "details": [
      { "field": "email", "message": "כתובת אימייל אינה תקינה" },
      { "field": "password", "message": "הסיסמה חייבת להכיל לפחות 8 תווים" }
    ]
  }
}
```
- `message`: הודעה בעברית, אפשר להציג אותה ישירות למשתמשת.
- `code`: קוד קבוע באנגלית, לבדיקות בקוד (למשל: אם `SLOT_TAKEN`, לרענן את הלוח).
- `details`: מופיע רק בשגיאת ולידציה. `field` הוא שם השדה בטופס, כך שאפשר להציג כל הודעה ליד השדה שלה.

### קודי שגיאה (HTTP Status)

| קוד | משמעות | מה כדאי לעשות באתר |
|---|---|---|
| `400` | הנתונים לא תקינים | להציג את `details` ליד השדות, או את `message` |
| `401` | לא מחוברת / Token לא תקף או פג | למחוק את ה-Token ולהעביר לדף הכניסה (חוץ מ-login עצמו, שם זה "אימייל או סיסמה שגויים") |
| `403` | אין הרשאה, או פעולה שאסורה כרגע | להציג את `message` |
| `404` | לא נמצא | להציג "לא נמצא" |
| `409` | התנגשות (משבצת נתפסה, אימייל קיים, שבת כבר פורסמה) | להציג את `message`. ב-`SLOT_TAKEN` גם לרענן את לוח השבוע |
| `429` | יותר מדי ניסיונות | להציג את `message` |
| `500` | תקלה בשרת | "אירעה שגיאה, נסי שוב" |

---

## 4. ערכים קבועים (Enums)

| שדה | ערכים | בעברית |
|---|---|---|
| `role` | `ADMIN`, `VOLUNTEER` | מנהלת, מתנדבת |
| `user.status` | `PENDING`, `ACTIVE`, `INACTIVE` | ממתינה, פעילה, מושבתת |
| `category` | `MAIN`, `SALAD`, `DESSERT`, `OTHER` | תבשיל, סלט, קינוח, אחר |
| `family.status` | `ACTIVE`, `FINISHED` | פעילה, סיימה |
| `shabbat.status` | `DRAFT`, `PUBLISHED`, `CLOSED` | טיוטה, פורסמה, סגורה |
| `slot.status` | `OPEN`, `TAKEN`, `DELIVERED` | פנויה, תפוסה, נמסרה |
| `assignment.status` | `ACTIVE`, `DELIVERED`, `CANCELLED` | פעיל, נמסר, בוטל |

> רוב התשובות כוללות כבר `categoryLabel` בעברית, כך שלא צריך לתרגם בעצמך.

### תאריכים
- **תאריך בלבד** (`shabbatDate`, `firstShabbat`): מחרוזת `"2026-10-24"`. זה גם הפורמט של `<input type="date">`, כך שאפשר להעביר אותו כמו שהוא.
- **תאריך ושעה** (`deliveryDeadline`, `createdAt`): מחרוזת ISO ב-UTC, למשל `"2026-10-22T18:00:00.000Z"`. כשמציגים, ממירים לשעון ישראל (למשל עם `toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })`). כך `18:00Z` יוצג כ-21:00.

---

## 5. מסכים ← אילו קריאות צריך

### מסכים כלליים

| מסך | קריאה | הערות |
|---|---|---|
| כניסה | `POST /api/auth/login` | לשמור `token`, ולנתב לפי `user.role` |
| הרשמה | `POST /api/auth/register` | בהצלחה: להציג "הבקשה נשלחה, החשבון ייפתח לאחר אישור" (בלי להתחבר) |
| שכחתי סיסמה | `POST /api/auth/forgot-password` | תמיד מחזיר הצלחה. להציג "אם הכתובת רשומה, נשלח קישור" |
| סיסמה חדשה | `POST /api/auth/reset-password` | הדף נפתח מהקישור במייל: `/reset-password?token=...`. לוקחים את `token` מה-URL |
| טעינת האתר | `GET /api/auth/me` | לבדוק אם ה-Token השמור עדיין תקף |

> 📌 **חשוב:** הקישורים במיילים מובילים לכתובות האלה באתר ה-React: `/reset-password?token=...`, `/login`, `/profile`, `/admin`, `/admin/volunteers?status=PENDING`. כדאי שיהיו באתר נתיבים (Routes) בשמות האלה.

### מסכי מתנדבת

| מסך | קריאות | הערות |
|---|---|---|
| **לוח השבוע** (דף הבית) | `GET /api/shabbatot/current` | סינון: `?category=SALAD` ו/או `?onlyOpen=true`. אם `shabbat` הוא `null`, להציג "אין כרגע שבת פתוחה להרשמה" |
| **חלון הרשמה למשבצת** | `GET /api/products?category=<הקטגוריה של המשבצת>` ← `POST /api/assignments` | לבחירת מוצר. אחרי הצלחה: לרענן את לוח השבוע ואת "השיבוצים שלי" |
| **השיבוצים שלי** | `GET /api/assignments/mine` | אפשר `?upcoming=true` או `?status=ACTIVE` |
| ↳ ביטול | `DELETE /api/assignments/:id` | להציג את הכפתור רק אם `canCancel` הוא `true` |
| ↳ סימון "נמסר" | `PATCH /api/assignments/:id/delivered` | |
| **הפרופיל שלי** | `GET /api/auth/me` ← `PUT /api/users/me` | הסרה מרשימת המיילים: `{ "receiveWeeklyEmail": false }` |
| ↳ שינוי סיסמה | `PUT /api/users/me/password` | |

### מסכי מנהלת

| מסך | קריאות |
|---|---|
| **לוח בקרה** | `GET /api/reports/dashboard` |
| **שבתות** (רשימה + היסטוריה) | `GET /api/shabbatot` (אפשר `?status=CLOSED`), `POST /api/shabbatot` |
| **ניהול שבת** | `GET /api/shabbatot/:id`, `PUT /api/shabbatot/:id`, `DELETE /api/shabbatot/:id` (טיוטה בלבד) |
| ↳ יצירת משבצות | `POST /api/shabbatot/:id/generate-slots` |
| ↳ משבצת ידנית | `POST /api/slots`, `PUT /api/slots/:id`, `DELETE /api/slots/:id` |
| ↳ פרסום | `PATCH /api/shabbatot/:id/publish`. מחזיר `distributionListMessage`, שאפשר להציג עם כפתור "העתקה" |
| ↳ סגירה | `PATCH /api/shabbatot/:id/close` |
| ↳ דוח והורדת אקסל | `GET /api/reports/week/:id`, `GET /api/reports/week/:id/export` (קובץ CSV) |
| **ניהול משפחות** | `GET /api/families` (חיפוש, סינון, מיון, עמודים), `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id` (סיום סיוע) |
| **ניהול מוצרים** | `GET /api/products?includeInactive=true`, `POST`, `PUT /:id`, `DELETE /:id` (השבתה) |
| **ניהול מתנדבות** | `GET /api/users` (`?status=PENDING` לבקשות ממתינות, `?q=` לחיפוש), `POST /api/users`, `GET /:id`, `PATCH /:id` |
| **מעקב שיבוצים** | `GET /api/assignments?shabbatId=2`, `DELETE /api/assignments/:id` (ביטול), `POST /api/assignments` עם `userId` (שיבוץ ידני), `PATCH /api/assignments/:id/delivered` ("התקבל") |

> **הורדת ה-CSV:** הנתיב מוגן ב-Token, ולכן קישור רגיל (`<a href>`) לא יעבוד, כי הוא לא שולח כותרות. צריך להוריד את הקובץ בקריאה עם ה-Token (תשובה מסוג blob), ואז לשמור אותו. שם הקובץ נמצא בכותרת `Content-Disposition`.

---

## 6. פירוט הקריאות העיקריות

### 🔑 התחברות – `POST /api/auth/login` (פתוח)
**שולחים:**
```json
{ "email": "sara@example.com", "password": "Volunteer123!" }
```
**200 – מקבלים:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": "7d",
  "user": {
    "id": 2,
    "firstName": "שרה",
    "lastName": "כהן",
    "email": "sara@example.com",
    "phone": "0521234567",
    "address": null,
    "role": "VOLUNTEER",
    "status": "ACTIVE",
    "receiveWeeklyEmail": true,
    "createdAt": "2026-10-15T20:04:32.322Z",
    "updatedAt": "2026-10-15T20:04:32.322Z"
  }
}
```
**שגיאות:**
- `401 INVALID_CREDENTIALS`: "אימייל או סיסמה שגויים".
- `403 ACCOUNT_PENDING`: "בקשת ההצטרפות שלך עדיין ממתינה לאישור המנהלת".
- `403 ACCOUNT_INACTIVE`: החשבון הושבת.

### 📝 הרשמה – `POST /api/auth/register` (פתוח)
| שדה | חובה | כללים |
|---|---|---|
| `firstName` | ✅ | 2–50 תווים |
| `lastName` | ✅ | 2–50 תווים |
| `phone` | ✅ | טלפון ישראלי. מותר עם מקפים, למשל `050-1234567` |
| `email` | ✅ | אימייל תקין |
| `password` | ✅ | 8 תווים לפחות, אות אחת וספרה אחת |
| `address` | | עד 200 תווים |

**201:**
```json
{ "message": "בקשת ההצטרפות נשלחה. החשבון ייפתח לאחר אישור המנהלת", "user": { "...": "..." } }
```
**שגיאות:** `409 EMAIL_TAKEN`, `400` (ולידציה, עם `details`).

> שדות שלא מופיעים ברשימה (למשל `role`) נדחים עם `400`. אי אפשר "להירשם כמנהלת".

### 🔁 איפוס סיסמה
- `POST /api/auth/forgot-password` ← `{ "email": "..." }` ← `200 { "message": "..." }`
- `POST /api/auth/reset-password` ← `{ "token": "<64 תווים מה-URL>", "password": "NewPass123" }`
  - `200`: הסיסמה עודכנה.
  - `400 RESET_TOKEN_INVALID`: הקישור פג או כבר נוצל.

### 🏠 לוח השבוע – `GET /api/shabbatot/current` (מחוברת)
**פרמטרים (רשות):**
- `category=MAIN|SALAD|DESSERT|OTHER`
- `onlyOpen=true`

**200:**
```json
{
  "shabbat": {
    "id": 2,
    "shabbatDate": "2026-10-24",
    "parasha": "נח",
    "deliveryDeadline": "2026-10-22T18:00:00.000Z",
    "cancelDeadline": "2026-10-21T18:00:00.000Z",
    "collectionPoint": "רחוב הרב קוק 12, בית השם",
    "message": "שבוע טוב לכולן! השבוע שלוש משפחות שמחות מחכות לעזרתנו 💗",
    "status": "PUBLISHED",
    "isOpenForRegistration": true
  },
  "slotCounts": { "total": 9, "open": 6, "taken": 3, "delivered": 0 },
  "families": [
    {
      "label": "משפחה א'",
      "peopleCount": 5,
      "simchaType": "בת",
      "dietaryNotes": null,
      "slots": [
        { "id": 13, "category": "MAIN", "categoryLabel": "תבשיל", "portions": 5, "status": "TAKEN", "productName": "עוף בתנור", "isMine": true },
        { "id": 14, "category": "SALAD", "categoryLabel": "סלט", "portions": 5, "status": "OPEN", "productName": null, "isMine": false }
      ]
    }
  ]
}
```
- **אם אין שבת מפורסמת:** `{ "shabbat": null, "slotCounts": null, "families": [] }`.
- `isOpenForRegistration: false` → השבת סגורה (אחרי חמישי 21:00). מציגים את הלוח בלי כפתורי הרשמה.
- `isMine: true` → המשבצת שלך. כדאי לסמן אותה בצבע.
- 🔒 שם המשפחה, הכתובת והטלפון **לא נשלחים בכלל** למתנדבות. יש רק `label`.
- למשפחה אין `id` בלוח. כ-key ברשימה אפשר להשתמש ב-`label`, וכ-key למשבצת ב-`slot.id`.

### 🙋 הרשמה למשבצת – `POST /api/assignments` (מחוברת)
| שדה | חובה | הערה |
|---|---|---|
| `slotId` | ✅ | `slot.id` מלוח השבוע |
| `productId` | ✅ | מוצר מאותה קטגוריה (מ-`GET /api/products?category=...`) |
| `note` | | עד 300 תווים |
| `userId` | | **מנהלת בלבד**: שיבוץ ידני של מתנדבת אחרת |

**שולחים:**
```json
{ "slotId": 14, "productId": 5, "note": "אביא בקופסה חד פעמית" }
```
**201 – מקבלים** (אותו מבנה כמו פריט ב"השיבוצים שלי", ראי למטה).

**שגיאות:**

| קוד | code | מתי |
|---|---|---|
| 409 | `SLOT_TAKEN` | מישהי הקדימה אותך. "המשבצת נתפסה, בחרי אחרת". לרענן את הלוח! |
| 409 | `SHABBAT_CLOSED` | ההרשמה נסגרה |
| 400 | `PRODUCT_CATEGORY_MISMATCH` | המוצר לא מהקטגוריה של המשבצת |
| 400 | `PRODUCT_NOT_AVAILABLE` | המוצר הושבת |
| 404 | `SLOT_NOT_FOUND` | המשבצת לא קיימת |

### 📋 השיבוצים שלי – `GET /api/assignments/mine` (מחוברת)
**פרמטרים (רשות):**
- `status=ACTIVE|DELIVERED|CANCELLED`
- `upcoming=true`

**200** – מערך. כל פריט:
```json
{
  "id": 11,
  "status": "ACTIVE",
  "note": null,
  "createdAt": "2026-10-15T20:04:32.830Z",
  "cancelledAt": null,
  "deliveredAt": null,
  "canCancel": true,
  "product": { "id": 6, "name": "סלט כרוב", "category": "SALAD" },
  "slot": { "id": 11, "category": "SALAD", "categoryLabel": "סלט", "portions": 7 },
  "family": { "label": "משפחה ב'", "peopleCount": 7, "simchaType": "בן", "dietaryNotes": "ללא גלוטן לאחד הילדים" },
  "shabbat": {
    "id": 2,
    "shabbatDate": "2026-10-24",
    "parasha": "נח",
    "deliveryDeadline": "2026-10-22T18:00:00.000Z",
    "cancelDeadline": "2026-10-21T18:00:00.000Z",
    "collectionPoint": "רחוב הרב קוק 12, בית השם",
    "message": "...",
    "status": "PUBLISHED",
    "isOpenForRegistration": true
  }
}
```

### ❌ ביטול – `DELETE /api/assignments/:id` (מחוברת)
**200**: מחזיר את השיבוץ עם `"status": "CANCELLED"`, והמשבצת חוזרת להיות פנויה.

**שגיאות:**
- `403 CANCEL_DEADLINE_PASSED`: "אפשר לבטל עד יום רביעי בשעה 21:00...".
- `403 FORBIDDEN`: ניסיון לבטל שיבוץ של מישהי אחרת.
- `409 ASSIGNMENT_NOT_ACTIVE`: השיבוץ כבר בוטל או נמסר.

### ✅ נמסר – `PATCH /api/assignments/:id/delivered` (מחוברת)
בלי גוף. **200**: השיבוץ עם `"status": "DELIVERED"`.

### 👤 עדכון פרופיל – `PUT /api/users/me` (מחוברת)
שולחים **רק** את השדות שמשתנים:
- `firstName`
- `lastName`
- `phone`
- `address`
- `receiveWeeklyEmail`

```json
{ "phone": "052-9998877", "receiveWeeklyEmail": false }
```
**200**: הפרופיל המעודכן.

**שינוי סיסמה** – `PUT /api/users/me/password`:
```json
{ "currentPassword": "Volunteer123!", "newPassword": "MyNewPass456" }
```
סיסמה נוכחית שגויה מחזירה `400 WRONG_PASSWORD`.

---

### 🛡️ קריאות של מנהלת

#### משפחות – `/api/families`
**חיפוש ומיון – פרמטרים ל-`GET`:**

| פרמטר | ערכים |
|---|---|
| `q` | חיפוש בשם, כתובת או סוג שמחה |
| `status` | `ACTIVE` / `FINISHED` |
| `sortBy` | `familyName` / `createdAt` / `firstShabbat` / `peopleCount` |
| `order` | `asc` / `desc` |
| `page`, `pageSize` | עמודים (ברירת מחדל 1 ו-20, מקסימום 100) |

לדוגמה: `GET /api/families?status=ACTIVE&q=לוי&sortBy=familyName&order=asc&page=1`

**טופס משפחה (`POST`, ו-`PUT` עם השדות שמשתנים):**

| שדה | חובה | כללים |
|---|---|---|
| `familyName` | ✅ | 2–100 תווים |
| `peopleCount` | ✅ | מספר שלם 1–30 (לשלוח כמספר, לא כמחרוזת!) |
| `simchaType` | ✅ | 2–50 תווים, למשל "בן", "בת" |
| `firstShabbat` | ✅ | `YYYY-MM-DD` |
| `lastShabbat` | ✅ | `YYYY-MM-DD`, לא לפני `firstShabbat` |
| `contactPhone` | | טלפון ישראלי |
| `address` | | עד 200 |
| `dietaryNotes` | | עד 500 (המתנדבות רואות) |
| `deliveryNotes` | | עד 500 (רק מנהלת) |
| `status` | | רק ב-`PUT`: `ACTIVE` / `FINISHED` |

> ⚠️ שדות מספריים (`peopleCount`, `portions`, `slotId`, `productId`) נשלחים כ**מספר** (`7`) ולא כמחרוזת (`"7"`). ב-React Hook Form אפשר להשתמש ב-`valueAsNumber`.

#### מוצרים – `/api/products`

| שדה | חובה | כללים |
|---|---|---|
| `name` | ✅ | 2–100, ייחודי בתוך הקטגוריה (אחרת `409 PRODUCT_EXISTS`) |
| `category` | ✅ | `MAIN` / `SALAD` / `DESSERT` / `OTHER` |
| `description` | | עד 300 |
| `isActive` | | רק ב-`PUT` (להחזרת מוצר מושבת) |

#### שבתות – `/api/shabbatot`
**יצירה (`POST`):**

| שדה | חובה | כללים |
|---|---|---|
| `shabbatDate` | ✅ | `YYYY-MM-DD`, חייב להיות יום שבת ולא בעבר |
| `parasha` | ✅ | 2–50 |
| `collectionPoint` | | בלי ערך נלקחת ברירת המחדל |
| `message` | | דברי פתיחה, עד 2000 |

**שגיאות ביצירה:** `400 NOT_SATURDAY`, `400 DATE_IN_PAST`, `409 SHABBAT_EXISTS`.

**סדר העבודה של המנהלת:**
1. `POST /api/shabbatot` – השבת נוצרת כטיוטה (`DRAFT`).
2. `POST /api/shabbatot/:id/generate-slots` – גוף רשות: `{ "categories": ["MAIN","SALAD","DESSERT"] }`. מחזיר `{ familiesCount, created, skipped, board }`.
3. (רשות) עריכת משבצות ב-`/api/slots`.
4. `PATCH /api/shabbatot/:id/publish` – מחזיר `{ shabbat, distributionListMessage, emailsQueued }`.
   - **שגיאות:** `409 NO_SLOTS`, `409 ALREADY_PUBLISHED`, `409 DEADLINE_PASSED`.

**`GET /api/shabbatot/:id` (הלוח המלא) – דוגמה מקוצרת:**
```json
{
  "shabbat": { "id": 2, "shabbatDate": "2026-10-24", "parasha": "נח", "status": "PUBLISHED", "...": "..." },
  "slotCounts": { "total": 9, "open": 5, "taken": 4, "delivered": 0 },
  "families": [
    {
      "id": 1,
      "familyName": "משפחת אדלר",
      "contactPhone": "0504445566",
      "address": "רחוב הרימון 8",
      "peopleCount": 9,
      "simchaType": "תאומים",
      "dietaryNotes": "בלי אגוזים",
      "deliveryNotes": null,
      "...": "...",
      "slots": [
        {
          "id": 16,
          "category": "MAIN",
          "categoryLabel": "תבשיל",
          "portions": 9,
          "status": "TAKEN",
          "assignment": {
            "id": 10,
            "status": "ACTIVE",
            "note": "אביא בתבנית חד פעמית",
            "createdAt": "2026-10-15T20:04:32.823Z",
            "deliveredAt": null,
            "product": { "id": 1, "name": "עוף בתנור" },
            "user": { "id": 2, "firstName": "שרה", "lastName": "כהן", "phone": "0521234567", "email": "sara@example.com" }
          }
        }
      ]
    }
  ],
  "distributionListMessage": "🍲 עזר ליולדת – שבת פרשת נח (24.10.2026)\n..."
}
```
`assignment` הוא `null` כשהמשבצת פנויה. ב-`distributionListMessage` יש ירידות שורה (`\n`). כדי להציג אותן, משתמשים ב-CSS `white-space: pre-line`.

#### משבצות – `/api/slots`
- **`POST`:** `{ "shabbatId": 2, "familyId": 1, "category": "SALAD", "portions": 9 }`. השדה `portions` רשות.
- **`PUT /:id`:** `{ "portions": 10 }` או `{ "category": "OTHER" }`.
- **`DELETE /:id`**

עריכה ומחיקה אפשריות רק במשבצת פנויה (`409 SLOT_NOT_OPEN`) ובשבת שלא נסגרה (`409 SHABBAT_CLOSED`).

#### מתנדבות – `/api/users`
- **`GET`:** פרמטרים `q`, `status`, `sortBy` (`firstName` / `lastName` / `createdAt`), `order`, `page`, `pageSize`. לכל מתנדבת מוחזרים גם `assignmentsCount` ו-`notes`.
- **`POST`** (הוספה ישירה):
  - **חובה:** `firstName`, `lastName`, `phone`, `email`.
  - **רשות:** `password` (בלי סיסמה, המתנדבת מקבלת מייל לבחירת סיסמה), `address`, `notes`, `receiveWeeklyEmail`.
  - **מחזיר:** `{ user, inviteEmailSent }`.
- **`PATCH /:id`:**
  - אישור בקשה: `{ "status": "ACTIVE" }` (נשלח למתנדבת מייל).
  - השבתה: `{ "status": "INACTIVE" }`.
  - אפשר לעדכן גם פרטים ו-`notes`.

#### לוח בקרה – `GET /api/reports/dashboard`
```json
{
  "upcomingShabbat": {
    "shabbat": { "id": 2, "parasha": "נח", "...": "..." },
    "slotCounts": { "total": 9, "open": 5, "taken": 4, "delivered": 0 },
    "familiesCount": 3,
    "volunteersCount": 2,
    "totalPortions": 63,
    "familiesMissing": [
      { "familyId": 2, "familyName": "משפחת לוי", "openCategories": ["תבשיל", "קינוח"] }
    ]
  },
  "pendingVolunteers": 1,
  "activeVolunteers": 2,
  "activeFamilies": 4
}
```
`upcomingShabbat` הוא `null` כשאין שבת קרובה.

#### מעקב שיבוצים – `GET /api/assignments`
**פרמטרים:** `shabbatId`, `userId`, `status`.

מחזיר מערך. בכל פריט: `user` (שם, טלפון, אימייל), `product`, `slot`, `family` (עם `familyName`) ו-`shabbat`.

---

## 7. טיפים לבניית צד ה-React (בלי קוד)

- **מקום אחד לקריאות לשרת:** כדאי לרכז במקום אחד את ה-Base URL, הוספת כותרת ה-Authorization, וטיפול אחיד ב-401 (מחיקת Token ומעבר לכניסה). כך לא משכפלים קוד בכל מסך.
- **React Query:**
  - קריאות `GET` (לוח השבוע, השיבוצים שלי, רשימות) מתאימות ל-queries.
  - פעולות (`POST`/`PUT`/`PATCH`/`DELETE`) מתאימות ל-mutations.
  - אחרי mutation מצליח, מרעננים (invalidate) את ה-queries שהשתנו. למשל: אחרי הרשמה למשבצת, לרענן את "לוח השבוע" ואת "השיבוצים שלי".
- **מצב התחברות גלובלי:** את ה-Token ואת פרטי המשתמשת (כולל `role`) נוח להחזיק ב-Context או ב-Redux, כדי שכל מסך יוכל לדעת מי מחוברת.
- **טפסים:** את כללי הוולידציה שבטבלאות למעלה כדאי לבדוק גם בטופס, כדי לתת משוב מיידי. השרת בודק בכל מקרה, ומחזיר `details` עם שם השדה.
- **Loading ושגיאות:**
  - בזמן טעינה מציגים Loading. השרת החינמי יכול להתעורר לאט בפעם הראשונה.
  - בשגיאה מציגים את `error.message`, שמגיע מוכן בעברית.

## 8. כשמעלים את ה-React לענן

1. ב-Render: **New**, ואז **Static Site**, ובוחרים את ה-Repository של ה-React.
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
2. משתנה סביבה `VITE_API_URL` = הכתובת של השרת (`https://ezer-leyoledet-api.onrender.com`).
3. 🔎 כדי שרענון בדפים פנימיים (למשל `/my-assignments`) לא יחזיר 404, מוסיפים ב-Static Site, בלשונית **Redirects/Rewrites**, כלל:
   - **Source:** `/*`
   - **Destination:** `/index.html`
   - **Action:** **Rewrite**
4. **בשרת** (ב-Render, בשירות `ezer-leyoledet-api`, בלשונית **Environment**) מעדכנים:
   - `CORS_ORIGINS` = הכתובת של אתר ה-React. אפשר להשאיר גם את `http://localhost:5173`, מופרד בפסיק.
   - `CLIENT_URL` = הכתובת של אתר ה-React (לקישורים במיילים).
