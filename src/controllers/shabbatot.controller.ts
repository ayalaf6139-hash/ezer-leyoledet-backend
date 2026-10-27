import type { Request, Response } from 'express';
import * as shabbatotService from '../services/shabbatot.service';
import * as slotsService from '../services/slots.service';
import { currentUser } from '../middleware/auth';
import { idParam } from '../validation/common';
import {
  createShabbatSchema,
  createSlotSchema,
  currentBoardQuery,
  generateSlotsSchema,
  listShabbatotQuery,
  updateShabbatSchema,
  updateSlotSchema,
} from '../validation/shabbatot.schemas';

export async function current(req: Request, res: Response) {
  res.json(await shabbatotService.getCurrentBoard(currentUser(req).id, currentBoardQuery.parse(req.query)));
}

export async function list(req: Request, res: Response) {
  res.json(await shabbatotService.listShabbatot(listShabbatotQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await shabbatotService.createShabbat(createShabbatSchema.parse(req.body)));
}

export async function getById(req: Request, res: Response) {
  res.json(await shabbatotService.getShabbatBoard(idParam.parse(req.params).id));
}

export async function update(req: Request, res: Response) {
  res.json(await shabbatotService.updateShabbat(idParam.parse(req.params).id, updateShabbatSchema.parse(req.body)));
}

export async function remove(req: Request, res: Response) {
  await shabbatotService.deleteShabbat(idParam.parse(req.params).id);
  res.status(204).end();
}

export async function generateSlots(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.status(201).json(await shabbatotService.generateSlots(id, generateSlotsSchema.parse(req.body)));
}

export async function publish(req: Request, res: Response) {
  res.json(await shabbatotService.publishShabbat(idParam.parse(req.params).id));
}

export async function close(req: Request, res: Response) {
  res.json(await shabbatotService.closeShabbat(idParam.parse(req.params).id));
}

// ---------- משבצות ----------

export async function createSlot(req: Request, res: Response) {
  res.status(201).json(await slotsService.createSlot(createSlotSchema.parse(req.body)));
}

export async function updateSlot(req: Request, res: Response) {
  res.json(await slotsService.updateSlot(idParam.parse(req.params).id, updateSlotSchema.parse(req.body)));
}

export async function deleteSlot(req: Request, res: Response) {
  await slotsService.deleteSlot(idParam.parse(req.params).id);
  res.status(204).end();
}
