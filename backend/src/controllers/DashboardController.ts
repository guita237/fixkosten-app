import { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { isValidDate, today } from '../utils/dateOnly';
import { currentUser, em } from './helpers';

function referenceDate(req: Request): string {
  // ?date=YYYY-MM-DD erlaubt Tests und "Was wäre wenn"-Ansichten
  if (typeof req.query.date === 'string' && isValidDate(req.query.date)) {
    return req.query.date;
  }
  return today();
}

function service(req: Request): DashboardService {
  return new DashboardService(em(), currentUser(req));
}

export const DashboardController = {
  async monthly(req: Request, res: Response): Promise<void> {
    res.json(await service(req).monthlySummary(referenceDate(req)));
  },

  async upcoming(req: Request, res: Response): Promise<void> {
    let months = 2;
    const requested = Number(req.query.months);
    if (Number.isInteger(requested) && requested >= 1 && requested <= 24) {
      months = requested;
    }
    res.json(await service(req).upcoming(referenceDate(req), months));
  },

  async month(req: Request, res: Response): Promise<void> {
    let month = today().substring(0, 7);
    if (typeof req.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)) {
      month = req.query.month;
    }
    res.json(await service(req).month(month));
  },

  async payouts(req: Request, res: Response): Promise<void> {
    res.json(await service(req).upcomingPayouts(referenceDate(req)));
  },

  async deadlines(req: Request, res: Response): Promise<void> {
    res.json(await service(req).contractDeadlines(referenceDate(req)));
  },
};
