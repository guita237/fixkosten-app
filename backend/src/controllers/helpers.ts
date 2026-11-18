import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ZodError } from 'zod';
import { NotFoundError, ValidationError } from '../services/ExpenseService';
import { User } from '../entities/User';
import { CsvFormatError } from '../import/CsvReader';

export function em(): EntityManager {
  const current = RequestContext.getEntityManager();
  if (!current) {
    throw new Error('Kein EntityManager im RequestContext');
  }
  return current as EntityManager;
}

export function currentUser(req: Request): User {
  if (!req.user) {
    throw new Error('Kein Benutzer am Request');
  }
  return req.user;
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError(`Ungültige ID: ${value}`);
  }
  return id;
}

type Handler = (req: Request, res: Response) => Promise<void>;

/** Fängt Fehler zentral ab und übersetzt sie in HTTP-Statuscodes. */
export function handle(fn: Handler) {
  return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Validierungsfehler', details: err.issues });
      } else if (err instanceof ValidationError || err instanceof CsvFormatError) {
        res.status(400).json({ error: err.message });
      } else if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
      } else if (err instanceof Error && err.name === 'UniqueConstraintViolationException') {
        res.status(409).json({ error: 'Eintrag existiert bereits' });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Interner Serverfehler' });
      }
    }
  };
}
