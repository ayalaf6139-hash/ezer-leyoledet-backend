import { emailEnabled, env, isTest } from '../../config/env';

export interface EmailMessage {
  to: { email: string; name?: string };
  subject: string;
  html: string;
}

/**
 * תיבת דואר יוצא בזיכרון – שומרת את המיילים האחרונים כשאין מפתח Brevo.
 * משמשת לבדיקות האוטומטיות ולצפייה בזמן פיתוח. לא נשמר בה דבר כשהמיילים נשלחים באמת.
 */
const MAX_OUTBOX = 200;
export const devOutbox: EmailMessage[] = [];

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendWithBrevo(message: EmailMessage): Promise<void> {
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY as string,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
      to: [message.to],
      subject: message.subject,
      htmlContent: message.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Brevo responded ${response.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * שליחת מייל. לעולם לא זורקת שגיאה: תקלה במייל לא תכשיל את הפעולה עצמה
 * (למשל הרשמה למשבצת), אלא רק תירשם ביומן השרת.
 * מחזירה true אם המייל נשלח (או נרשם במצב פיתוח).
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!emailEnabled) {
    devOutbox.push(message);
    if (devOutbox.length > MAX_OUTBOX) devOutbox.shift();
    if (!isTest) {
      console.log(`📧 [מייל לא נשלח – אין BREVO_API_KEY] אל: ${message.to.email} | נושא: ${message.subject}`);
    }
    return true;
  }
  try {
    await sendWithBrevo(message);
    return true;
  } catch (err) {
    console.error(`❌ שליחת מייל אל ${message.to.email} נכשלה:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/** שליחה לכמה נמענות בזו אחר זו. מחזירה כמה מיילים נשלחו בהצלחה */
export async function sendMany(messages: EmailMessage[]): Promise<number> {
  let sent = 0;
  for (const message of messages) {
    if (await sendEmail(message)) sent += 1;
  }
  return sent;
}

/** מפעיל שליחה ברקע בלי לעכב את התשובה ללקוח */
export function sendInBackground(task: () => Promise<unknown>): void {
  task().catch((err) => console.error('❌ שגיאה בשליחת מיילים ברקע:', err));
}
