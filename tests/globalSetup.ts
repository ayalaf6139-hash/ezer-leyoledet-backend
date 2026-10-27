import { execSync } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';

/**
 * רץ פעם אחת לפני כל הבדיקות: מוודא שמסד הבדיקות מעודכן (prisma migrate deploy).
 * הגנה: הבדיקות מוחקות נתונים, ולכן מסרבות לרוץ אם שם מסד הנתונים לא כולל "test".
 */
export default function setup() {
  const fileEnv = fs.existsSync('.env.test') ? dotenv.parse(fs.readFileSync('.env.test')) : {};
  const url = fileEnv.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('חסר DATABASE_URL לבדיקות. העתיקי את .env.test.example ל-.env.test ועדכני את הכתובת.');
  }
  const dbName = new URL(url).pathname.replace('/', '');
  if (!dbName.toLowerCase().includes('test')) {
    throw new Error(
      `מסד הנתונים "${dbName}" לא נראה כמו מסד בדיקות (חייב לכלול "test" בשם). הבדיקות לא הופעלו כדי לא למחוק נתונים אמיתיים.`,
    );
  }
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, ...fileEnv, DATABASE_URL: url } });
}
