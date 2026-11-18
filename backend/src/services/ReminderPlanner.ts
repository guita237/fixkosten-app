// Reine Logik: welche Erinnerungen sind heute fällig, und wie lautet die E-Mail?
import { addDays, diffDays, parseDate } from '../utils/dateOnly';

export type ReminderKind = 'CANCELLATION_DEADLINE' | 'PAYOUT' | 'OVERDUE';
export type Language = 'de' | 'fr' | 'en';

export interface Reminder {
  kind: ReminderKind;
  /** Eindeutiger Schlüssel gegen doppelten Versand */
  key: string;
  expenseId: number;
  name: string;
  date: string;
  daysUntil: number;
  amountCents: number | null;
}

export interface PlannerInput {
  deadlines: { expenseId: number; name: string; cancellationDeadline: string | null; termEnd: string | null }[];
  payouts: { expenseId: number; name: string; date: string; amountCents: number }[];
  overdue: { expenseId: number; name: string; dueDate: string; expectedCents: number }[];
}

/**
 * Kündigungsfristen: einmal sobald sie im Vorlauf liegen ("early") und noch einmal
 * am letzten Tag davor ("last"). Auszahlungen: einmal im Vorlauf. Überfällige: einmal.
 * Fällt ein Lauf aus, wird beim nächsten nachgeholt (Fenster statt exakter Tag).
 */
/** Überfällige Fälligkeiten nur so weit zurück erinnern (verhindert eine Flut beim ersten Einschalten). */
export const OVERDUE_LOOKBACK_DAYS = 14;

export function planReminders(input: PlannerInput, today: string, daysBefore: number): Reminder[] {
  const result: Reminder[] = [];

  for (const d of input.deadlines) {
    if (!d.cancellationDeadline) {
      continue;
    }
    const daysUntil = diffDays(today, d.cancellationDeadline);
    if (daysUntil < 0 || daysUntil > daysBefore) {
      continue;
    }
    let stage = 'early';
    if (daysUntil <= 1) {
      stage = 'last';
    }
    result.push({
      kind: 'CANCELLATION_DEADLINE',
      key: `deadline:${d.expenseId}:${d.cancellationDeadline}:${stage}`,
      expenseId: d.expenseId,
      name: d.name,
      date: d.cancellationDeadline,
      daysUntil,
      amountCents: null,
    });
  }

  for (const p of input.payouts) {
    const daysUntil = diffDays(today, p.date);
    if (daysUntil < 0 || daysUntil > daysBefore) {
      continue;
    }
    result.push({
      kind: 'PAYOUT',
      key: `payout:${p.expenseId}:${p.date}`,
      expenseId: p.expenseId,
      name: p.name,
      date: p.date,
      daysUntil,
      amountCents: p.amountCents,
    });
  }

  const oldestOverdue = addDays(today, -OVERDUE_LOOKBACK_DAYS);
  for (const o of input.overdue) {
    if (o.dueDate < oldestOverdue) {
      continue;
    }
    result.push({
      kind: 'OVERDUE',
      key: `overdue:${o.expenseId}:${o.dueDate}`,
      expenseId: o.expenseId,
      name: o.name,
      date: o.dueDate,
      daysUntil: diffDays(today, o.dueDate),
      amountCents: o.expectedCents,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function withoutAlreadySent(reminders: Reminder[], sentKeys: Set<string>): Reminder[] {
  return reminders.filter((r) => !sentKeys.has(r.key));
}

// ---------- E-Mail-Text ----------

function plural(n: number, one: string, many: string): string {
  if (n === 1) {
    return one;
  }
  return many;
}

const LOCALE: Record<Language, string> = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };

const TEXT = {
  de: {
    subject: (n: number) => `Fixkosten: ${n} ${plural(n, 'Erinnerung', 'Erinnerungen')}`,
    hello: 'Hallo,',
    intro: 'hier ist deine Übersicht:',
    deadline: (name: string, date: string, days: number) => `Kündigungsfrist „${name}“: bis ${date} (${dayWord('de', days)})`,
    payout: (name: string, date: string, amount: string) => `Auszahlung „${name}“: ${amount} am ${date}`,
    overdue: (name: string, date: string, amount: string) => `Noch nicht als bezahlt markiert: „${name}“, fällig ${date}, ${amount}`,
    footer: 'Erinnerungen kannst du in den Einstellungen der App ändern.',
    testSubject: 'Fixkosten: Test-E-Mail',
    testBody: 'Der E-Mail-Versand funktioniert.',
  },
  fr: {
    subject: (n: number) => `Fixkosten : ${n} ${plural(n, 'rappel', 'rappels')}`,
    hello: 'Bonjour,',
    intro: 'voici ton récapitulatif :',
    deadline: (name: string, date: string, days: number) => `Préavis « ${name} » : jusqu’au ${date} (${dayWord('fr', days)})`,
    payout: (name: string, date: string, amount: string) => `Versement « ${name} » : ${amount} le ${date}`,
    overdue: (name: string, date: string, amount: string) => `Pas encore marqué comme payé : « ${name} », échéance ${date}, ${amount}`,
    footer: 'Tu peux modifier les rappels dans les paramètres de l’app.',
    testSubject: 'Fixkosten : e-mail de test',
    testBody: 'L’envoi d’e-mails fonctionne.',
  },
  en: {
    subject: (n: number) => `Fixkosten: ${n} ${plural(n, 'reminder', 'reminders')}`,
    hello: 'Hi,',
    intro: 'here is your overview:',
    deadline: (name: string, date: string, days: number) => `Cancellation deadline "${name}": by ${date} (${dayWord('en', days)})`,
    payout: (name: string, date: string, amount: string) => `Payout "${name}": ${amount} on ${date}`,
    overdue: (name: string, date: string, amount: string) => `Not yet marked as paid: "${name}", due ${date}, ${amount}`,
    footer: 'You can change reminders in the app settings.',
    testSubject: 'Fixkosten: test email',
    testBody: 'Email delivery works.',
  },
};

function dayWord(lang: Language, days: number): string {
  if (lang === 'de') {
    if (days === 0) {
      return 'heute';
    } else if (days === 1) {
      return 'morgen';
    } else {
      return `in ${days} Tagen`;
    }
  } else if (lang === 'fr') {
    if (days === 0) {
      return 'aujourd’hui';
    } else if (days === 1) {
      return 'demain';
    } else {
      return `dans ${days} jours`;
    }
  } else {
    if (days === 0) {
      return 'today';
    } else if (days === 1) {
      return 'tomorrow';
    } else {
      return `in ${days} days`;
    }
  }
}

export function formatMoney(cents: number, lang: Language, currency = 'EUR'): string {
  return (cents / 100).toLocaleString(LOCALE[lang], { style: 'currency', currency });
}

export function formatDateLocal(date: string, lang: Language): string {
  const p = parseDate(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).toLocaleDateString(LOCALE[lang], { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface EmailContent {
  subject: string;
  text: string;
}

export function buildDigest(reminders: Reminder[], lang: Language, currency = 'EUR'): EmailContent {
  const t = TEXT[lang];
  const lines = reminders.map((r) => {
    const date = formatDateLocal(r.date, lang);
    if (r.kind === 'CANCELLATION_DEADLINE') {
      return '• ' + t.deadline(r.name, date, r.daysUntil);
    } else if (r.kind === 'PAYOUT') {
      return '• ' + t.payout(r.name, date, formatMoney(r.amountCents ?? 0, lang, currency));
    } else {
      return '• ' + t.overdue(r.name, date, formatMoney(r.amountCents ?? 0, lang, currency));
    }
  });
  return {
    subject: t.subject(reminders.length),
    text: [t.hello, '', t.intro, '', ...lines, '', '—', t.footer].join('\n'),
  };
}

export function buildTestMail(lang: Language): EmailContent {
  return { subject: TEXT[lang].testSubject, text: TEXT[lang].testBody };
}

/** Hilfsfunktion für Tests und Vorschau: Datum n Tage nach heute. */
export function daysFrom(today: string, n: number): string {
  return addDays(today, n);
}
