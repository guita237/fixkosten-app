import { z } from 'zod';
import { Frequency, NoticeUnit } from '../enums/Frequency';
import { PaymentStatus } from '../entities/Payment';
import { isValidDate } from '../utils/dateOnly';

const dateOnly = z.string().refine(isValidDate, { message: 'Datum im Format YYYY-MM-DD erwartet' });

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const contractSchema = z.object({
  startDate: dateOnly,
  endDate: dateOnly.nullable().optional(),
  noticeValue: z.number().int().min(0).max(36),
  noticeUnit: z.nativeEnum(NoticeUnit),
  autoRenewMonths: z.number().int().min(0).max(60).default(0),
  cancelled: z.boolean().default(false),
  cancelledOn: dateOnly.nullable().optional(),
  consumerContract: z.boolean().default(false),
});

export const payoutSchema = z.object({
  date: dateOnly,
  amountCents: z.number().int().min(0),
  received: z.boolean().default(false),
  note: z.string().max(500).nullable().optional(),
});

export const expenseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: z.string().trim().max(120).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  amountCents: z.number().int().min(0),
  frequency: z.nativeEnum(Frequency),
  firstDueDate: dateOnly,
  endDate: dateOnly.nullable().optional(),
  paymentMethod: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().default(true),
  note: z.string().max(2000).nullable().optional(),
  contract: contractSchema.nullable().optional(),
  // Fehlt das Feld, bleiben die Auszahlungen unverändert; ein Array ersetzt alle
  payouts: z.array(payoutSchema).max(60).optional(),
}).refine((e) => !e.endDate || e.endDate >= e.firstDueDate, {
  message: 'endDate darf nicht vor firstDueDate liegen',
  path: ['endDate'],
});

export const priceChangeSchema = z.object({
  validFrom: dateOnly,
  amountCents: z.number().int().min(0),
  note: z.string().max(500).nullable().optional(),
});

export const paymentSchema = z.object({
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.PAID),
  paidDate: dateOnly.nullable().optional(),
  amountCents: z.number().int().min(0).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

// Alle Felder optional: nur mitgeschickte Werte werden geändert
export const importConfirmSchema = z.object({
  matches: z
    .array(
      z.object({
        type: z.enum(['EXPENSE', 'PAYOUT']),
        expenseId: z.number().int().positive(),
        targetDate: dateOnly,
        bookingDate: dateOnly,
        bookedCents: z.number().int().min(0),
        reference: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const meSchema = z.object({
  monthlyNetIncomeCents: z.number().int().min(0).nullable().optional(),
  language: z.enum(['de', 'fr', 'en']).optional(),
  remindersEnabled: z.boolean().optional(),
  reminderEmail: z.string().email().nullable().optional(),
  reminderDaysBefore: z.number().int().min(1).max(60).optional(),
  reminderOverdue: z.boolean().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ContractInputDto = z.infer<typeof contractSchema>;
export type PayoutInputDto = z.infer<typeof payoutSchema>;
export type PaymentInputDto = z.infer<typeof paymentSchema>;
export type ImportConfirmDto = z.infer<typeof importConfirmSchema>;
export type PriceChangeInputDto = z.infer<typeof priceChangeSchema>;
