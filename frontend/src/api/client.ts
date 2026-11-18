import type {
  Category,
  ColumnMapping,
  ContractDeadline,
  Expense,
  ExpenseInput,
  ImportPreview,
  MatchSuggestion,
  Me,
  MonthlySummary,
  MonthResult,
  PaymentMonth,
  TrackedDue,
  UpcomingPayment,
  UpcomingPayout,
} from './types';

/** Fehler der API mit Statuscode und Meldung des Backends. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
  }
}

type TokenProvider = () => Promise<Record<string, string>>;

let authHeaders: TokenProvider = async () => ({});

/** Wird vom AuthProvider gesetzt: liefert Authorization- bzw. Dev-Header. */
export function setAuthHeaderProvider(provider: TokenProvider): void {
  authHeaders = provider;
}

async function request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()), ...extraHeaders };
  let payload: BodyInit | undefined = undefined;
  if (body instanceof Blob) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, { method, headers, body: payload });
  if (response.status === 204) {
    return undefined as T;
  }
  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    if (data && typeof data === 'object' && 'error' in data) {
      message = String((data as { error: unknown }).error);
    }
    let details: unknown = undefined;
    if (data && typeof data === 'object' && 'details' in data) {
      details = (data as { details: unknown }).details;
    }
    throw new ApiError(response.status, message, details);
  }
  return data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) {
    return '';
  }
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const api = {
  me: () => request<Me>('GET', '/me'),
  updateMe: (patch: Partial<Omit<Me, 'id' | 'email' | 'currency'>>) => request<Me>('PUT', '/me', patch),

  categories: () => request<Category[]>('GET', '/categories'),
  createCategory: (c: { name: string; color: string }) => request<Category>('POST', '/categories', c),
  updateCategory: (id: number, c: { name: string; color: string }) => request<Category>('PUT', `/categories/${id}`, c),
  deleteCategory: (id: number) => request<void>('DELETE', `/categories/${id}`),

  expenses: () => request<Expense[]>('GET', '/expenses'),
  expense: (id: number) => request<Expense>('GET', `/expenses/${id}`),
  createExpense: (e: ExpenseInput) => request<Expense>('POST', '/expenses', e),
  updateExpense: (id: number, e: ExpenseInput) => request<Expense>('PUT', `/expenses/${id}`, e),
  deleteExpense: (id: number) => request<void>('DELETE', `/expenses/${id}`),
  addPriceChange: (id: number, c: { validFrom: string; amountCents: number; note: string | null }) =>
    request<Expense>('POST', `/expenses/${id}/price-changes`, c),
  removePriceChange: (id: number, changeId: number) => request<Expense>('DELETE', `/expenses/${id}/price-changes/${changeId}`),

  monthly: () => request<MonthlySummary>('GET', '/dashboard/monthly'),
  month: (month: string) => request<MonthResult>('GET', `/dashboard/month${qs({ month })}`),
  upcoming: (months: number) => request<UpcomingPayment[]>('GET', `/upcoming${qs({ months })}`),
  upcomingPayouts: () => request<UpcomingPayout[]>('GET', '/payouts/upcoming'),
  deadlines: () => request<ContractDeadline[]>('GET', '/contracts/deadlines'),

  payments: (month: string) => request<PaymentMonth>('GET', `/payments${qs({ month })}`),
  overdue: () => request<TrackedDue[]>('GET', '/payments/overdue'),
  recordPayment: (expenseId: number, dueDate: string, p: { status: 'PAID' | 'SKIPPED'; paidDate?: string | null; amountCents?: number | null }) =>
    request<unknown>('PUT', `/expenses/${expenseId}/payments/${dueDate}`, p),
  clearPayment: (expenseId: number, dueDate: string) => request<void>('DELETE', `/expenses/${expenseId}/payments/${dueDate}`),

  importCsv: (file: File, mapping?: ColumnMapping) =>
    request<ImportPreview>('POST', `/imports/csv${qs({ ...(mapping ?? {}) })}`, file, { 'Content-Type': 'text/csv' }),
  confirmImport: (matches: { type: MatchSuggestion['type']; expenseId: number; targetDate: string; bookingDate: string; bookedCents: number; reference: string | null }[]) =>
    request<{ paymentsRecorded: number; payoutsReceived: number }>('POST', '/imports/confirm', { matches }),

  testMail: () => request<{ to: string; mailerConfigured: boolean }>('POST', '/reminders/test'),
};
