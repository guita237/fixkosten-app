import { Request, Response } from 'express';
import { User } from '../entities/User';
import { meSchema } from '../validation/schemas';
import { currentUser, em } from './helpers';

function toDto(u: User) {
  return {
    id: u.id,
    email: u.email,
    currency: u.currency,
    monthlyNetIncomeCents: u.monthlyNetIncomeCents ?? null,
    language: u.language,
    remindersEnabled: u.remindersEnabled,
    reminderEmail: u.reminderEmail ?? null,
    reminderDaysBefore: u.reminderDaysBefore,
    reminderOverdue: u.reminderOverdue,
  };
}

export const MeController = {
  async get(req: Request, res: Response): Promise<void> {
    res.json(toDto(currentUser(req)));
  },

  async update(req: Request, res: Response): Promise<void> {
    const input = meSchema.parse(req.body);
    const user = currentUser(req);
    if (input.monthlyNetIncomeCents !== undefined) {
      user.monthlyNetIncomeCents = input.monthlyNetIncomeCents;
    }
    if (input.language !== undefined) {
      user.language = input.language;
    }
    if (input.remindersEnabled !== undefined) {
      user.remindersEnabled = input.remindersEnabled;
    }
    if (input.reminderEmail !== undefined) {
      user.reminderEmail = input.reminderEmail;
    }
    if (input.reminderDaysBefore !== undefined) {
      user.reminderDaysBefore = input.reminderDaysBefore;
    }
    if (input.reminderOverdue !== undefined) {
      user.reminderOverdue = input.reminderOverdue;
    }
    await em().flush();
    res.json(toDto(user));
  },
};
