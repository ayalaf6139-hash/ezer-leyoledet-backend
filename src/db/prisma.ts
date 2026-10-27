import { PrismaClient } from '@prisma/client';

// מופע יחיד של Prisma לכל השרת
export const prisma = new PrismaClient();
