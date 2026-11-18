import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { ValidationError } from '../services/ExpenseService';
import { paymentSchema } from '../validation/schemas';
import { isValidDate, today } from '../utils/dateOnly';
import { currentUser, em, parseId } from './helpers';

function service(req: Request): PaymentService {
  return new PaymentService(em(), currentUser(req));
}

function referenceDate(req: Request): string {
  if (typeof req.query.date === 'string' && isValidDate(req.query.date)) {
    return req.query.date;
  }
  return today();
}

function dueDateParam(req: Request): string {
  if (!isValidDate(req.params.dueDate)) {
    throw new ValidationError('Fälligkeit im Format YYYY-MM-DD erwartet');
  }
  return req.params.dueDate;
}

export const PaymentController = {
  async month(req: Request, res: Response): Promise<void> {
    let month = referenceDate(req).substring(0, 7);
    if (typeof req.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)) {
      month = req.query.month;
    }
    res.json(await service(req).month(month, referenceDate(req)));
  },

  async overdue(req: Request, res: Response): Promise<void> {
    res.json(await service(req).overdue(referenceDate(req)));
  },

  async record(req: Request, res: Response): Promise<void> {
    const input = paymentSchema.parse(req.body);
    const p = await service(req).record(parseId(req.params.id), dueDateParam(req), input);
    res.json({ dueDate: p.dueDate, status: p.status, paidDate: p.paidDate ?? null, amountCents: p.amountCents ?? null, source: p.source, note: p.note ?? null });
  },

  async clear(req: Request, res: Response): Promise<void> {
    await service(req).clear(parseId(req.params.id), dueDateParam(req));
    res.status(204).end();
  },
};
