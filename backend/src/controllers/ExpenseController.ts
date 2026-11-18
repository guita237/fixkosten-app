import { Request, Response } from 'express';
import { ExpenseService, toExpenseDto } from '../services/ExpenseService';
import { expenseSchema, priceChangeSchema } from '../validation/schemas';
import { currentUser, em, parseId } from './helpers';

function service(req: Request): ExpenseService {
  return new ExpenseService(em(), currentUser(req));
}

export const ExpenseController = {
  async list(req: Request, res: Response): Promise<void> {
    let categoryId: number | undefined = undefined;
    if (typeof req.query.categoryId === 'string') {
      categoryId = parseId(req.query.categoryId);
    }
    const expenses = await service(req).list(categoryId);
    res.json(expenses.map((e) => toExpenseDto(e)));
  },

  async get(req: Request, res: Response): Promise<void> {
    const expense = await service(req).get(parseId(req.params.id));
    res.json(toExpenseDto(expense));
  },

  async create(req: Request, res: Response): Promise<void> {
    const input = expenseSchema.parse(req.body);
    const expense = await service(req).create(input);
    res.status(201).json(toExpenseDto(expense));
  },

  async update(req: Request, res: Response): Promise<void> {
    const input = expenseSchema.parse(req.body);
    const expense = await service(req).update(parseId(req.params.id), input);
    res.json(toExpenseDto(expense));
  },

  async addPriceChange(req: Request, res: Response): Promise<void> {
    const input = priceChangeSchema.parse(req.body);
    const expense = await service(req).addPriceChange(parseId(req.params.id), input);
    res.status(201).json(toExpenseDto(expense));
  },

  async removePriceChange(req: Request, res: Response): Promise<void> {
    const expense = await service(req).removePriceChange(parseId(req.params.id), parseId(req.params.changeId));
    res.json(toExpenseDto(expense));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await service(req).remove(parseId(req.params.id));
    res.status(204).end();
  },
};
