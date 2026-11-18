import { Request, Response } from 'express';
import { ReminderService } from '../services/ReminderService';
import { getMailer } from '../services/Mailer';
import { isValidDate, today } from '../utils/dateOnly';
import { currentUser, em } from './helpers';

function service(req: Request): ReminderService {
  return new ReminderService(em(), currentUser(req), getMailer());
}

function referenceDate(req: Request): string {
  if (typeof req.query.date === 'string' && isValidDate(req.query.date)) {
    return req.query.date;
  }
  return today();
}

export const ReminderController = {
  /** Was heute verschickt würde (ohne zu senden). */
  async preview(req: Request, res: Response): Promise<void> {
    res.json(await service(req).pending(referenceDate(req)));
  },

  /** Jetzt für den eigenen Benutzer verschicken (unabhängig vom Cron). */
  async run(req: Request, res: Response): Promise<void> {
    res.json(await service(req).run(referenceDate(req)));
  },

  async test(req: Request, res: Response): Promise<void> {
    res.json(await service(req).sendTest());
  },
};
