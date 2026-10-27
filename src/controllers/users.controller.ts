import type { Request, Response } from 'express';
import * as usersService from '../services/users.service';
import { currentUser } from '../middleware/auth';
import { idParam } from '../validation/common';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuery,
  updateMeSchema,
  updateUserSchema,
} from '../validation/users.schemas';

export async function updateMe(req: Request, res: Response) {
  res.json(await usersService.updateMe(currentUser(req).id, updateMeSchema.parse(req.body)));
}

export async function changePassword(req: Request, res: Response) {
  await usersService.changePassword(currentUser(req).id, changePasswordSchema.parse(req.body));
  res.json({ message: 'הסיסמה עודכנה בהצלחה' });
}

export async function list(req: Request, res: Response) {
  res.json(await usersService.listVolunteers(listUsersQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await usersService.createVolunteer(createUserSchema.parse(req.body)));
}

export async function getById(req: Request, res: Response) {
  res.json(await usersService.getVolunteer(idParam.parse(req.params).id));
}

export async function update(req: Request, res: Response) {
  res.json(await usersService.updateUser(idParam.parse(req.params).id, updateUserSchema.parse(req.body)));
}
