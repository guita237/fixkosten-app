import { Request, Response } from 'express';
import { ImportService } from '../import/ImportService';
import { ColumnMapping } from '../import/CsvReader';
import { ValidationError } from '../services/ExpenseService';
import { importConfirmSchema } from '../validation/schemas';
import { currentUser, em } from './helpers';

function service(req: Request): ImportService {
  return new ImportService(em(), currentUser(req));
}

function queryString(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (typeof v === 'string' && v.trim() !== '') {
    return v;
  }
  return undefined;
}

/** Optional: ?dateColumn=…&amountColumn=…&counterpartyColumn=…&referenceColumn=… */
function manualMapping(req: Request): ColumnMapping | undefined {
  const date = queryString(req, 'dateColumn');
  const amount = queryString(req, 'amountColumn');
  if (!date && !amount) {
    return undefined;
  }
  if (!date || !amount) {
    throw new ValidationError('dateColumn und amountColumn müssen zusammen angegeben werden');
  }
  return { date, amount, counterparty: queryString(req, 'counterpartyColumn'), reference: queryString(req, 'referenceColumn') };
}

export const ImportController = {
  /** Body = CSV-Datei roh (Content-Type text/csv oder application/octet-stream). */
  async preview(req: Request, res: Response): Promise<void> {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new ValidationError('CSV-Datei als Request-Body erwartet (Content-Type: text/csv)');
    }
    res.json(await service(req).preview(req.body, manualMapping(req)));
  },

  async confirm(req: Request, res: Response): Promise<void> {
    const input = importConfirmSchema.parse(req.body);
    res.json(await service(req).confirm(input));
  },
};
