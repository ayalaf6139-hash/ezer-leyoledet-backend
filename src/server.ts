import { env, emailEnabled } from './config/env';
import { createApp } from './app';
import { prisma } from './db/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`✅ השרת פועל בפורט ${env.PORT} (${env.NODE_ENV})`);
  console.log(`   בדיקת בריאות: http://localhost:${env.PORT}/api/health`);
  console.log(`   Swagger:       http://localhost:${env.PORT}/api-docs`);
  if (!emailEnabled) console.log('   📧 מיילים: מצב יומן בלבד (לא הוגדר BREVO_API_KEY / EMAIL_FROM)');
  if (!env.CRON_SECRET) console.log('   ⏰ תזכורות מתוזמנות: כבויות (לא הוגדר CRON_SECRET)');
});

// כיבוי מסודר (למשל כש-Render מפעיל גרסה חדשה)
function shutdown(signal: string) {
  console.log(`${signal} התקבל – סוגר את השרת...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
