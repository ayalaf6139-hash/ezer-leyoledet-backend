import type { Request, Response } from 'express';
import * as reportsService from '../services/reports.service';
import * as jobsService from '../services/jobs.service';
import { idParam } from '../validation/common';

export async function dashboard(_req: Request, res: Response) {
  res.json(await reportsService.dashboard());
}

export async function week(req: Request, res: Response) {
  res.json(await reportsService.weekReport(idParam.parse(req.params).id));
}

export async function weekExport(req: Request, res: Response) {
  const { filename, content } = await reportsService.weekReportCsv(idParam.parse(req.params).id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}

// ---------- משימות מתוזמנות ----------

export async function thursdayReminders(_req: Request, res: Response) {
  res.json(await jobsService.sendThursdayReminders());
}

export async function openSlotsReport(_req: Request, res: Response) {
  res.json(await jobsService.sendOpenSlotsReport());
}
