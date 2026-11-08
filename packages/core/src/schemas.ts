import { z } from 'zod';
import { isCurrency } from './currencies';
import { isValidVpa } from './upi';
import { BILL_SOURCES, CHARGE_TYPES, FEE_RULES } from './types';

const minor = z.number().int().safe();
const currency = z
  .string()
  .length(3)
  .transform((s) => s.toUpperCase())
  .refine(isCurrency, 'Unknown currency');
const name = z.string().trim().min(1, 'Add a name').max(60);
const deviceToken = z.string().min(16).max(128);

export const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  amountMinor: minor,
  qty: z.number().int().min(1).max(999).default(1),
});

export const chargeSchema = z.object({
  id: z.string().optional(),
  type: z.enum(CHARGE_TYPES),
  label: z.string().trim().max(60).default(''),
  amountMinor: minor,
});

export const feeRulesSchema = z.record(z.enum(CHARGE_TYPES), z.enum(FEE_RULES)).default({});

export const upiIdSchema = z
  .string()
  .trim()
  .refine(isValidVpa, 'That doesn’t look like a UPI ID. It should look like name@bank.');

export const billWriteSchema = z.object({
  title: z.string().trim().min(1).max(80),
  merchant: z.string().trim().max(80).optional(),
  currency,
  source: z.enum(BILL_SOURCES).default('manual'),
  splitMode: z.enum(['items', 'even']).default('items'),
  feeRules: feeRulesSchema,
  date: z.string().datetime({ offset: true }).optional(),
  tripId: z.string().optional(),
  payerMemberId: z.string().optional(),
  fxRateToBase: z.number().positive().optional(),
  detectedTotalMinor: minor.optional(),
  items: z.array(itemSchema).max(300),
  charges: z.array(chargeSchema).max(50),
  /** Host details, used when the bill is not in a trip. */
  hostName: name.optional(),
  hostUpiId: upiIdSchema.optional().or(z.literal('')),
  /** Extra people to add right away (for even splits or trips). */
  participants: z.array(z.object({ name, memberId: z.string().optional() })).max(50).default([]),
});
export type BillWrite = z.infer<typeof billWriteSchema>;

export const joinSchema = z.object({ name, deviceToken });

export const claimSchema = z.object({
  participantId: z.string(),
  itemId: z.string(),
  claimed: z.boolean(),
});

export const paymentStatusSchema = z.object({
  status: z.enum(['unpaid', 'marked', 'confirmed']),
});

export const settingsSchema = z.object({
  displayName: name,
  defaultCurrency: currency,
  upiId: upiIdSchema.optional().or(z.literal('')).nullable(),
});

export const tripCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseCurrency: currency,
  ownerName: name,
  ownerUpiId: upiIdSchema.optional().or(z.literal('')),
});

export const tripJoinSchema = z.object({
  name,
  deviceToken,
  memberId: z.string().optional(),
  upiId: upiIdSchema.optional().or(z.literal('')),
});

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function randomSlug(len = 6, rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < len; i++) s += SLUG_ALPHABET[Math.floor(rand() * SLUG_ALPHABET.length)];
  return s;
}
export const slugSchema = z.string().regex(/^[a-z0-9]{4,12}$/);
