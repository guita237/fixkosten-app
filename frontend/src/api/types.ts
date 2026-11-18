// Typen der Backend-DTOs (siehe backend/src/services und controllers)

export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type NoticeUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type Language = 'de' | 'fr' | 'en';

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Contract {
  startDate: string;
  endDate: string | null;
  noticeValue: number;
  noticeUnit: NoticeUnit;
  autoRenewMonths: number;
  cancelled: boolean;
  cancelledOn: string | null;
  consumerContract: boolean;
}

export interface Payout {
  id?: number;
  date: string;
  amountCents: number;
  received: boolean;
  note?: string | null;
}

export interface PriceChange {
  id: number;
  validFrom: string;
  amountCents: number;
  note: string | null;
}

export interface Expense {
  id: number;
  name: string;
  provider: string | null;
  category: Category | null;
  amountCents: number;
  currentAmountCents: number;
  monthlyCostCents: number;
  frequency: Frequency;
  firstDueDate: string;
  endDate: string | null;
  effectiveEndDate: string | null;
  ended: boolean;
  paymentMethod: string | null;
  active: boolean;
  note: string | null;
  contract: Contract | null;
  payouts: Payout[];
  priceChanges: PriceChange[];
}

export interface ExpenseInput {
  name: string;
  provider: string | null;
  categoryId: number | null;
  amountCents: number;
  frequency: Frequency;
  firstDueDate: string;
  endDate: string | null;
  paymentMethod: string | null;
  active: boolean;
  note: string | null;
  contract: Contract | null;
  payouts: Payout[];
}

export interface Me {
  id: number;
  email: string;
  currency: string;
  monthlyNetIncomeCents: number | null;
  language: Language;
  remindersEnabled: boolean;
  reminderEmail: string | null;
  reminderDaysBefore: number;
  reminderOverdue: boolean;
}

export interface CategoryTotal {
  categoryId: number | null;
  name: string;
  color: string;
  monthlyCents: number;
}

export interface MonthlySummary {
  totalMonthlyCents: number;
  activeCount: number;
  byCategory: CategoryTotal[];
  incomeCents: number | null;
  remainingCents: number | null;
}

export interface BalanceEntry {
  type: 'EXPENSE' | 'PAYOUT';
  expenseId: number;
  name: string;
  date: string;
  amountCents: number;
  received?: boolean;
}

export interface MonthResult {
  month: string;
  outgoingCents: number;
  incomingCents: number;
  netCents: number;
  entries: BalanceEntry[];
  incomeCents: number | null;
  availableCents: number | null;
}

export interface UpcomingPayment {
  type: 'EXPENSE' | 'PAYOUT';
  expenseId: number;
  name: string;
  dueDate: string;
  amountCents: number;
}

export interface UpcomingPayout {
  expenseId: number;
  name: string;
  date: string;
  amountCents: number;
  daysUntil: number;
}

export interface ContractDeadline {
  expenseId: number;
  name: string;
  termEnd: string | null;
  cancellationDeadline: string | null;
  daysUntilDeadline: number | null;
  earliestEndIfCancelledToday: string | null;
}

export type TrackedStatus = 'OPEN' | 'OVERDUE' | 'PAID' | 'SKIPPED';

export interface TrackedDue {
  expenseId: number;
  name: string;
  dueDate: string;
  expectedCents: number;
  status: TrackedStatus;
  paidDate: string | null;
  paidCents: number | null;
  differenceCents: number | null;
  source: string | null;
}

export interface PaymentMonth {
  month: string;
  items: TrackedDue[];
  summary: { expectedCents: number; paidCents: number; openCents: number; overdueCount: number };
}

export interface BankTransaction {
  index: number;
  date: string;
  amountCents: number;
  counterparty: string;
  reference: string;
}

export interface MatchSuggestion {
  transactionIndex: number;
  type: 'EXPENSE' | 'PAYOUT';
  expenseId: number;
  name: string;
  targetDate: string;
  expectedCents: number;
  bookedCents: number;
  bookingDate: string;
  score: number;
  confidence: 'HIGH' | 'MEDIUM';
  reasons: string[];
}

export interface ImportPreview {
  format: string;
  skippedRows: number;
  transactions: BankTransaction[];
  suggestions: MatchSuggestion[];
  stats: { transactions: number; suggested: number; highConfidence: number };
}

export interface ColumnMapping {
  dateColumn: string;
  amountColumn: string;
  counterpartyColumn?: string;
  referenceColumn?: string;
}
