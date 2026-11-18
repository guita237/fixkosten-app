import { Request, Response } from 'express';
import { User } from '../entities/User';
import { meSchema } from '../validation/schemas';
import { currentUser, em } from './helpers';

function toDto(u: User) {
  return { id: u.id, email: u.email, currency: u.currency, monthlyNetIncomeCents: u.monthlyNetIncomeCents ?? null };
}

export const MeController = {
  async get(req: Request, res: Response): Promise<void> {
    res.json(toDto(currentUser(req)));
  },

  async update(req: Request, res: Response): Promise<void> {
    const input = meSchema.parse(req.body);
    const user = currentUser(req);
    user.monthlyNetIncomeCents = input.monthlyNetIncomeCents;
    await em().flush();
    res.json(toDto(user));
  },
};
