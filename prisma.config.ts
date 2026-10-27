import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// הגדרות Prisma: מיקום הסכמה, ה-migrations וסקריפט נתוני ההדגמה
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
