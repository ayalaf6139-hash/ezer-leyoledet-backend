import { env } from '../../config/env';
import { formatHebrewDate, formatHebrewDateTime } from '../../utils/dates';
import type { EmailMessage } from './emailService';

// תבניות המיילים. כל המיילים בעברית, מימין לשמאל.

interface Recipient {
  email: string;
  firstName: string;
  lastName?: string;
}

interface ShabbatInfo {
  parasha: string;
  shabbatDate: Date;
  deliveryDeadline: Date;
  collectionPoint: string;
}

export interface ItemLine {
  familyLabel: string;
  categoryLabel: string;
  productName: string;
  portions: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:0;background:#f7eef2;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;padding:24px;direction:rtl;text-align:right;">
    <h2 style="color:#7a3e5a;margin-top:0;">${escapeHtml(title)}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">
    <p style="font-size:12px;color:#999;">עזר ליולדת – קהילת בית השם · <a href="${env.CLIENT_URL}" style="color:#7a3e5a;">לאתר</a></p>
  </div>
</body>
</html>`;
}

const p = (text: string) => `<p style="line-height:1.6;">${text}</p>`;
const button = (href: string, text: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#7a3e5a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(text)}</a></p>`;
const to = (user: Recipient) => ({ email: user.email, name: `${user.firstName} ${user.lastName ?? ''}`.trim() });

function shabbatDetails(shabbat: ShabbatInfo): string {
  return `<ul style="line-height:1.8;padding-right:20px;">
    <li><b>שבת:</b> פרשת ${escapeHtml(shabbat.parasha)} (${formatHebrewDate(shabbat.shabbatDate)})</li>
    <li><b>מועד מסירה:</b> ${formatHebrewDateTime(shabbat.deliveryDeadline)}</li>
    <li><b>נקודת איסוף:</b> ${escapeHtml(shabbat.collectionPoint)}</li>
  </ul>`;
}

function itemsTable(items: ItemLine[]): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(item.familyLabel)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(item.categoryLabel)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(item.productName)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${item.portions} מנות</td>
      </tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

export const emails = {
  newJoinRequest(admin: Recipient, applicant: Recipient & { phone: string }): EmailMessage {
    return {
      to: to(admin),
      subject: `בקשת הצטרפות חדשה: ${applicant.firstName} ${applicant.lastName ?? ''}`,
      html: layout(
        'בקשת הצטרפות חדשה',
        p(`<b>${escapeHtml(applicant.firstName)} ${escapeHtml(applicant.lastName ?? '')}</b> ביקשה להצטרף כמתנדבת.`) +
          p(
            `טלפון: ${escapeHtml(applicant.phone)}<br>אימייל: ${escapeHtml(applicant.email)}`,
          ) +
          button(`${env.CLIENT_URL}/admin/volunteers?status=PENDING`, 'לאישור הבקשה'),
      ),
    };
  },

  accountApproved(user: Recipient): EmailMessage {
    return {
      to: to(user),
      subject: 'בקשת ההצטרפות שלך אושרה 🎉',
      html: layout(
        `שלום ${user.firstName},`,
        p('שמחות לבשר: בקשת ההצטרפות שלך ל"עזר ליולדת" אושרה! מעכשיו אפשר להתחבר ולהירשם להבאת ארוחות.') +
          button(`${env.CLIENT_URL}/login`, 'כניסה לאתר'),
      ),
    };
  },

  inviteSetPassword(user: Recipient, token: string): EmailMessage {
    return {
      to: to(user),
      subject: 'הוזמנת להצטרף ל"עזר ליולדת"',
      html: layout(
        `שלום ${user.firstName},`,
        p('המנהלת הוסיפה אותך כמתנדבת ב"עזר ליולדת". כדי להתחיל, יש לבחור סיסמה:') +
          button(`${env.CLIENT_URL}/reset-password?token=${token}`, 'בחירת סיסמה') +
          p('<small>הקישור תקף ל-72 שעות.</small>'),
      ),
    };
  },

  passwordReset(user: Recipient, token: string): EmailMessage {
    return {
      to: to(user),
      subject: 'איפוס סיסמה – עזר ליולדת',
      html: layout(
        `שלום ${user.firstName},`,
        p('קיבלנו בקשה לאיפוס הסיסמה שלך. לבחירת סיסמה חדשה:') +
          button(`${env.CLIENT_URL}/reset-password?token=${token}`, 'בחירת סיסמה חדשה') +
          p('<small>הקישור תקף לשעה אחת. אם לא ביקשת איפוס – אפשר להתעלם מהמייל.</small>'),
      ),
    };
  },

  weekPublished(user: Recipient, shabbat: ShabbatInfo & { message: string | null }, summary: string[]): EmailMessage {
    const list = summary.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    return {
      to: to(user),
      subject: `שבת פרשת ${shabbat.parasha} – אפשר להירשם להבאת ארוחות`,
      html: layout(
        `שלום ${user.firstName},`,
        (shabbat.message ? p(escapeHtml(shabbat.message).replace(/\n/g, '<br>')) : '') +
          p(`השבוע ${summary.length} משפחות שמחות מחכות לארוחות שבת:`) +
          `<ul style="line-height:1.8;padding-right:20px;">${list}</ul>` +
          shabbatDetails(shabbat) +
          button(`${env.CLIENT_URL}/`, 'ללוח השבוע ולהרשמה') +
          p(
            `<small>לא רוצה לקבל את הפרסום השבועי? אפשר להסיר את עצמך בדף <a href="${env.CLIENT_URL}/profile">הפרופיל שלי</a>.</small>`,
          ),
      ),
    };
  },

  assignmentConfirmed(user: Recipient, shabbat: ShabbatInfo, item: ItemLine, note: string | null): EmailMessage {
    return {
      to: to(user),
      subject: `תודה! נרשמת להביא ${item.productName}`,
      html: layout(
        `תודה ${user.firstName}!`,
        p('ההרשמה נקלטה והמשבצת שמורה לך. הפרטים:') +
          itemsTable([item]) +
          (note ? p(`<b>ההערה שלך:</b> ${escapeHtml(note)}`) : '') +
          shabbatDetails(shabbat) +
          p('אם משהו משתנה, אפשר לבטל עד יום רביעי בשעה 21:00 בדף "השיבוצים שלי".'),
      ),
    };
  },

  assignmentCancelledByAdmin(user: Recipient, shabbat: ShabbatInfo, item: ItemLine): EmailMessage {
    return {
      to: to(user),
      subject: `השיבוץ שלך לשבת פרשת ${shabbat.parasha} בוטל`,
      html: layout(
        `שלום ${user.firstName},`,
        p('המנהלת ביטלה את השיבוץ הבא, ואין צורך להביא אותו:') +
          itemsTable([item]) +
          p('לשאלות אפשר לפנות לאחראית הארגון. תודה על הנכונות!'),
      ),
    };
  },

  slotFreed(admin: Recipient, shabbat: ShabbatInfo, item: ItemLine, volunteerName: string): EmailMessage {
    return {
      to: to(admin),
      subject: `משבצת התפנתה – ${item.familyLabel}, ${item.categoryLabel}`,
      html: layout(
        'משבצת התפנתה',
        p(`${escapeHtml(volunteerName)} ביטלה את השיבוץ הבא לשבת פרשת ${escapeHtml(shabbat.parasha)}:`) +
          itemsTable([item]) +
          p('המשבצת חזרה להיות פנויה בלוח השבוע.'),
      ),
    };
  },

  thursdayReminder(user: Recipient, shabbat: ShabbatInfo, items: ItemLine[]): EmailMessage {
    return {
      to: to(user),
      subject: 'תזכורת: להביא את הארוחות עד 21:00 הערב',
      html: layout(
        `בוקר טוב ${user.firstName},`,
        p('תזכורת קטנה – היום מביאים את המאכלים לנקודת האיסוף:') +
          itemsTable(items) +
          shabbatDetails(shabbat) +
          p('תודה רבה על העזרה! 💗'),
      ),
    };
  },

  openSlotsReport(admin: Recipient, shabbat: ShabbatInfo, openItems: { familyName: string; categoryLabel: string; portions: number }[]): EmailMessage {
    const rows = openItems
      .map((item) => `<li>${escapeHtml(item.familyName)} – ${escapeHtml(item.categoryLabel)} (${item.portions} מנות)</li>`)
      .join('');
    return {
      to: to(admin),
      subject: openItems.length
        ? `${openItems.length} משבצות עדיין פתוחות לשבת פרשת ${shabbat.parasha}`
        : `כל המשבצות לשבת פרשת ${shabbat.parasha} תפוסות 🎉`,
      html: layout(
        'סטטוס משבצות לשבת הקרובה',
        (openItems.length
          ? p('המשבצות הבאות עדיין פנויות:') + `<ul style="line-height:1.8;padding-right:20px;">${rows}</ul>`
          : p('כל המשבצות תפוסות. כל הכבוד!')) +
          shabbatDetails(shabbat) +
          button(`${env.CLIENT_URL}/admin`, 'ללוח הבקרה'),
      ),
    };
  },
};
