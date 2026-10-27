import type { Request, Response } from 'express';
import * as familiesService from '../services/families.service';
import { idParam } from '../validation/common';
import { createFamilySchema, listFamiliesQuery, updateFamilySchema } from '../validation/families.schemas';

export async function list(req: Request, res: Response) {
  res.json(await familiesService.listFamilies(listFamiliesQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await familiesService.createFamily(createFamilySchema.parse(req.body)));
}

export async function getById(req: Request, res: Response) {
  res.json(await familiesService.getFamily(idParam.parse(req.params).id));
}

export async function update(req: Request, res: Response) {
  res.json(await familiesService.updateFamily(idParam.parse(req.params).id, updateFamilySchema.parse(req.body)));
}

export async function finish(req: Request, res: Response) {
  res.json(await familiesService.finishFamily(idParam.parse(req.params).id));
}
