import express, { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { heavyLimiter } from '../middleware/security';
import { handle } from '../controllers/helpers';
import { ExpenseController } from '../controllers/ExpenseController';
import { CategoryController } from '../controllers/CategoryController';
import { DashboardController } from '../controllers/DashboardController';
import { MeController } from '../controllers/MeController';
import { PaymentController } from '../controllers/PaymentController';
import { ReminderController } from '../controllers/ReminderController';
import { ImportController } from '../controllers/ImportController';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use(requireAuth);

apiRouter.get('/me', handle(MeController.get));
apiRouter.put('/me', handle(MeController.update));

apiRouter.get('/expenses', handle(ExpenseController.list));
apiRouter.post('/expenses', handle(ExpenseController.create));
apiRouter.get('/expenses/:id', handle(ExpenseController.get));
apiRouter.put('/expenses/:id', handle(ExpenseController.update));
apiRouter.delete('/expenses/:id', handle(ExpenseController.remove));
apiRouter.post('/expenses/:id/price-changes', handle(ExpenseController.addPriceChange));
apiRouter.delete('/expenses/:id/price-changes/:changeId', handle(ExpenseController.removePriceChange));

apiRouter.get('/categories', handle(CategoryController.list));
apiRouter.post('/categories', handle(CategoryController.create));
apiRouter.put('/categories/:id', handle(CategoryController.update));
apiRouter.delete('/categories/:id', handle(CategoryController.remove));

apiRouter.get('/dashboard/monthly', handle(DashboardController.monthly));
apiRouter.get('/dashboard/month', handle(DashboardController.month));
apiRouter.get('/upcoming', handle(DashboardController.upcoming));
apiRouter.get('/payouts/upcoming', handle(DashboardController.payouts));
apiRouter.get('/contracts/deadlines', handle(DashboardController.deadlines));

apiRouter.get('/payments', handle(PaymentController.month));
apiRouter.get('/payments/overdue', handle(PaymentController.overdue));
apiRouter.put('/expenses/:id/payments/:dueDate', handle(PaymentController.record));
apiRouter.delete('/expenses/:id/payments/:dueDate', handle(PaymentController.clear));

apiRouter.get('/reminders/preview', handle(ReminderController.preview));
apiRouter.post('/reminders/run', heavyLimiter, handle(ReminderController.run));
apiRouter.post('/reminders/test', heavyLimiter, handle(ReminderController.test));

// CSV kommt roh (nicht als JSON); max. 5 MB
const rawCsv = express.raw({ type: ['text/csv', 'text/plain', 'application/csv', 'application/octet-stream', 'application/vnd.ms-excel'], limit: '5mb' });
apiRouter.post('/imports/csv', heavyLimiter, rawCsv, handle(ImportController.preview));
apiRouter.post('/imports/confirm', handle(ImportController.confirm));
