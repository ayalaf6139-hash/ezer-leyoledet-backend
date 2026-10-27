import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { currentUser } from '../middleware/auth';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../validation/auth.schemas';

export async function register(req: Request, res: Response) {
  const user = await authService.register(registerSchema.parse(req.body));
  res.status(201).json({
    message: 'בקשת ההצטרפות נשלחה. החשבון ייפתח לאחר אישור המנהלת',
    user,
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  res.json(await authService.login(email, password));
}

export async function me(req: Request, res: Response) {
  res.json(await authService.getProfile(currentUser(req).id));
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(forgotPasswordSchema.parse(req.body).email);
  res.json({ message: 'אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה' });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(resetPasswordSchema.parse(req.body));
  res.json({ message: 'הסיסמה עודכנה. אפשר להתחבר עם הסיסמה החדשה' });
}
