import fs from 'node:fs';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

// הבדיקות רצות מול מסד נתונים נפרד שמוגדר בקובץ .env.test (ראו .env.test.example)
const envFile = fs.existsSync('.env.test') ? '.env.test' : undefined;
const testEnv = envFile ? dotenv.parse(fs.readFileSync(envFile)) : {};

export default defineConfig({
  test: {
    environment: 'node',
    env: { ...testEnv, NODE_ENV: 'test', LOGIN_RATE_LIMIT: testEnv.LOGIN_RATE_LIMIT ?? 'false' },
    globalSetup: ['tests/globalSetup.ts'],
    include: ['tests/**/*.test.ts'],
    // כל קובצי הבדיקה משתמשים באותו מסד נתונים – לכן רצים אחד אחרי השני
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
