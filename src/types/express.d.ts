import type { Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** המשתמשת המחוברת – נקבעת אך ורק לפי ה-Token (middleware authenticate) */
      user?: AuthUser;
    }
  }
}
