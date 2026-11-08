export const BILL_SOURCES = [
  'receipt',
  'swiggy',
  'zomato',
  'instamart',
  'zepto',
  'blinkit',
  'district',
  'eazydiner',
  'email',
  'manual',
] as const;
export type BillSource = (typeof BILL_SOURCES)[number];

export const CHARGE_TYPES = [
  'tax',
  'tip',
  'partner_tip',
  'delivery',
  'platform',
  'packaging',
  'discount',
  'coupon',
  'membership',
  'other',
] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

export const FEE_RULES = ['even', 'proportional', 'claims'] as const;
/**
 * even: split equally between every participant on the bill.
 * proportional: split by each person's share of item costs.
 * claims: split equally between participants who claimed at least one item.
 */
export type FeeRule = (typeof FEE_RULES)[number];
export type FeeRules = Partial<Record<ChargeType, FeeRule>>;

export const DEFAULT_FEE_RULES: Record<ChargeType, FeeRule> = {
  tax: 'proportional',
  tip: 'proportional',
  partner_tip: 'even',
  delivery: 'even',
  platform: 'even',
  packaging: 'even',
  discount: 'proportional',
  coupon: 'proportional',
  membership: 'proportional',
  other: 'proportional',
};

/** Charges that reduce the bill and are stored as negative amounts. */
export const NEGATIVE_CHARGE_TYPES: ChargeType[] = ['discount', 'coupon', 'membership'];

export const CHARGE_LABELS: Record<ChargeType, string> = {
  tax: 'Tax',
  tip: 'Tip',
  partner_tip: 'Delivery partner tip',
  delivery: 'Delivery fee',
  platform: 'Platform fee',
  packaging: 'Packaging',
  discount: 'Discount',
  coupon: 'Coupon',
  membership: 'Membership savings',
  other: 'Other charge',
};

export const SOURCE_LABELS: Record<BillSource, string> = {
  receipt: 'Scanned receipt',
  swiggy: 'Swiggy order',
  zomato: 'Zomato order',
  instamart: 'Swiggy Instamart order',
  zepto: 'Zepto order',
  blinkit: 'Blinkit order',
  district: 'District booking',
  eazydiner: 'EazyDiner booking',
  email: 'Email receipt',
  manual: 'Typed in',
};

export interface ItemInput {
  id: string;
  name?: string;
  /** Line total in minor units (price x qty). */
  amountMinor: number;
  qty?: number;
}

export interface ChargeInput {
  id: string;
  type: ChargeType;
  label?: string;
  /** Negative for discounts, coupons and membership savings. */
  amountMinor: number;
}

export interface ParticipantInput {
  id: string;
  name?: string;
}

export interface ClaimInput {
  itemId: string;
  participantId: string;
}

export interface BillInput {
  currency: string;
  splitMode: 'items' | 'even';
  items: ItemInput[];
  charges: ChargeInput[];
  participants: ParticipantInput[];
  claims: ClaimInput[];
  feeRules?: FeeRules;
}

/** Output of a parser: a bill that has not been saved yet. */
export interface BillDraft {
  source: BillSource;
  title?: string;
  merchant?: string;
  currency: string;
  date?: string;
  items: { name: string; amountMinor: number; qty: number }[];
  charges: { type: ChargeType; label: string; amountMinor: number }[];
  detectedSubtotalMinor?: number;
  detectedTotalMinor?: number;
  /** Values the payment screen of a booking app reported, e.g. a pre-booking discount. */
  warnings: string[];
  confidence: number;
}
