import type { Request, Response } from 'express';
import * as assignmentsService from '../services/assignments.service';
import { currentUser } from '../middleware/auth';
import { idParam } from '../validation/common';
import { createAssignmentSchema, listAssignmentsQuery, myAssignmentsQuery } from '../validation/assignments.schemas';

export async function create(req: Request, res: Response) {
  res.status(201).json(await assignmentsService.createAssignment(currentUser(req), createAssignmentSchema.parse(req.body)));
}

export async function mine(req: Request, res: Response) {
  res.json(await assignmentsService.listMine(currentUser(req), myAssignmentsQuery.parse(req.query)));
}

export async function list(req: Request, res: Response) {
  res.json(await assignmentsService.listAll(listAssignmentsQuery.parse(req.query)));
}

export async function cancel(req: Request, res: Response) {
  res.json(await assignmentsService.cancelAssignment(currentUser(req), idParam.parse(req.params).id));
}

export async function delivered(req: Request, res: Response) {
  res.json(await assignmentsService.markDelivered(currentUser(req), idParam.parse(req.params).id));
}
