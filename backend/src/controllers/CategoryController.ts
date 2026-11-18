import { Request, Response } from 'express';
import { Category } from '../entities/Category';
import { NotFoundError } from '../services/ExpenseService';
import { categorySchema } from '../validation/schemas';
import { currentUser, em, parseId } from './helpers';

function toDto(c: Category) {
  return { id: c.id, name: c.name, color: c.color };
}

async function findOwn(req: Request): Promise<Category> {
  const category = await em().findOne(Category, { id: parseId(req.params.id), user: currentUser(req) });
  if (!category) {
    throw new NotFoundError('Kategorie nicht gefunden');
  }
  return category;
}

export const CategoryController = {
  async list(req: Request, res: Response): Promise<void> {
    const categories = await em().find(Category, { user: currentUser(req) }, { orderBy: { name: 'asc' } });
    res.json(categories.map(toDto));
  },

  async create(req: Request, res: Response): Promise<void> {
    const input = categorySchema.parse(req.body);
    let color = '#64748b';
    if (input.color) {
      color = input.color;
    }
    const category = em().create(Category, { user: currentUser(req), name: input.name, color });
    await em().flush();
    res.status(201).json(toDto(category));
  },

  async update(req: Request, res: Response): Promise<void> {
    const input = categorySchema.parse(req.body);
    const category = await findOwn(req);
    category.name = input.name;
    if (input.color) {
      category.color = input.color;
    }
    await em().flush();
    res.json(toDto(category));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const category = await findOwn(req);
    await em().removeAndFlush(category);
    res.status(204).end();
  },
};
