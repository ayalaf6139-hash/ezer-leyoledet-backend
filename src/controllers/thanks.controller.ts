import type { Request, Response } from 'express';
import * as thanksService from '../services/thanks.service';
import { idParam } from '../validation/common';
import { createThankYouSchema, listThanksAdminQuery, updateThankYouSchema } from '../validation/thanks.schemas';

export async function create(req: Request, res: Response) {
  await thanksService.createThankYou(createThankYouSchema.parse(req.body));
  res.status(201).json({ message: 'תודה רבה! הדברים יוצגו באתר לאחר אישור' });
}

export async function listPublic(_req: Request, res: Response) {
  res.json(await thanksService.listApprovedThanks());
}

export async function listAdmin(req: Request, res: Response) {
  res.json(await thanksService.listThanksForAdmin(listThanksAdminQuery.parse(req.query)));
}

export async function update(req: Request, res: Response) {
  res.json(await thanksService.updateThankYou(idParam.parse(req.params).id, updateThankYouSchema.parse(req.body)));
}

export async function remove(req: Request, res: Response) {
  await thanksService.deleteThankYou(idParam.parse(req.params).id);
  res.status(204).end();
}
