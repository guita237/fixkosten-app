import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../entities/User';
import { Expense } from '../entities/Expense';
import { Payout } from '../entities/Payout';
import { PaymentSource, PaymentStatus } from '../entities/Payment';
import { parseBankCsv } from './BankFormats';
import { BankTransaction, ColumnMapping } from './CsvReader';
import { matchTransactions, MatchableItem, MatchSuggestion } from './TransactionMatcher';
import { toTrackableItem } from '../services/mappers';
import { PaymentService } from '../services/PaymentService';
import { NotFoundError } from '../services/ExpenseService';
import { ImportConfirmDto } from '../validation/schemas';

export interface ImportPreview {
  format: string;
  mapping: ColumnMapping;
  skippedRows: number;
  transactions: BankTransaction[];
  suggestions: MatchSuggestion[];
  stats: { transactions: number; suggested: number; highConfidence: number };
}

export class ImportService {
  constructor(private readonly em: EntityManager, private readonly user: User) {}

  /** Datei lesen und Zuordnungen vorschlagen. Es wird noch nichts gespeichert. */
  async preview(file: Buffer, manualMapping?: ColumnMapping): Promise<ImportPreview> {
    const parsed = parseBankCsv(file, manualMapping);
    const expenses = await this.em.find(Expense, { user: this.user, active: true }, { populate: ['contract', 'payouts', 'priceChanges', 'payments'] });
    const items: MatchableItem[] = expenses.map((e) => ({ ...toTrackableItem(e), provider: e.provider ?? null }));
    const suggestions = matchTransactions(parsed.transactions, items);
    return {
      format: parsed.format,
      mapping: parsed.mapping,
      skippedRows: parsed.skippedRows,
      transactions: parsed.transactions,
      suggestions,
      stats: {
        transactions: parsed.transactions.length,
        suggested: suggestions.length,
        highConfidence: suggestions.filter((s) => s.confidence === 'HIGH').length,
      },
    };
  }

  /** Vom Benutzer bestätigte Zuordnungen speichern: Zahlungen als bezahlt, Auszahlungen als erhalten. */
  async confirm(input: ImportConfirmDto): Promise<{ paymentsRecorded: number; payoutsReceived: number }> {
    const payments = new PaymentService(this.em, this.user);
    let paymentsRecorded = 0;
    let payoutsReceived = 0;

    for (const m of input.matches) {
      if (m.type === 'EXPENSE') {
        await payments.record(
          m.expenseId,
          m.targetDate,
          { status: PaymentStatus.PAID, paidDate: m.bookingDate, amountCents: m.bookedCents },
          PaymentSource.CSV,
          m.reference ?? null,
        );
        paymentsRecorded++;
      } else {
        const payout = await this.em.findOne(Payout, { expense: { id: m.expenseId, user: this.user }, date: m.targetDate });
        if (!payout) {
          throw new NotFoundError(`Auszahlung ${m.targetDate} für Ausgabe ${m.expenseId} nicht gefunden`);
        }
        payout.received = true;
        payoutsReceived++;
      }
    }
    await this.em.flush();
    return { paymentsRecorded, payoutsReceived };
  }
}
