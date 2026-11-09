import { useSyncExternalStore } from 'react';
import type { BillDraft, BillSource, ChargeType, FeeRules } from '@tabby/core';

// The bill being reviewed before it's saved. Kept outside React so the scan, share and
// import screens can hand a draft to the review screen without route params.
export interface EditableDraft {
  title: string;
  merchant?: string;
  source: BillSource;
  currency: string;
  date?: string;
  items: { key: string; id?: string; name: string; amount: string; qty: number }[];
  charges: { key: string; type: ChargeType; label: string; amount: string }[];
  feeRules: FeeRules;
  splitMode: 'items' | 'even';
  tip: { mode: 'none' } | { mode: 'percent'; percent: number } | { mode: 'fixed'; amount: string };
  detectedTotalMinor?: number;
  warnings: string[];
  tripSlug?: string;
  payerMemberId?: string;
  fxRate?: string;
  /** When editing an existing bill. */
  editingSlug?: string;
}

let current: EditableDraft | null = null;
const listeners = new Set<() => void>();

export const draftStore = {
  get: () => current,
  set(d: EditableDraft | null) {
    current = d;
    listeners.forEach((l) => l());
  },
  update(fn: (d: EditableDraft) => EditableDraft) {
    if (current) draftStore.set(fn(current));
  },
};

export function useDraft() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

let k = 0;
export const key = () => `k${Date.now().toString(36)}${(k++).toString(36)}`;

export function majorString(minor: number, decimals: number): string {
  if (decimals === 0) return String(minor);
  const neg = minor < 0;
  const s = Math.abs(minor).toString().padStart(decimals + 1, '0');
  return `${neg ? '-' : ''}${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

export function fromParsed(d: BillDraft, decimals: number, extra: Partial<EditableDraft> = {}): EditableDraft {
  const tip = d.charges.find((c) => c.type === 'tip');
  return {
    title: d.merchant ?? defaultTitle(d.source),
    merchant: d.merchant,
    source: d.source,
    currency: d.currency,
    date: d.date,
    items: d.items.map((i) => ({ key: key(), name: i.name, amount: majorString(i.amountMinor, decimals), qty: i.qty })),
    charges: d.charges
      .filter((c) => c !== tip)
      .map((c) => ({ key: key(), type: c.type, label: c.label, amount: majorString(Math.abs(c.amountMinor), decimals) })),
    feeRules: {},
    splitMode: 'items',
    tip: tip ? { mode: 'fixed', amount: majorString(tip.amountMinor, decimals) } : { mode: 'none' },
    detectedTotalMinor: d.detectedTotalMinor,
    warnings: d.warnings,
    ...extra,
  };
}

export function emptyDraft(currency: string, extra: Partial<EditableDraft> = {}): EditableDraft {
  return {
    title: '',
    source: 'manual',
    currency,
    items: [{ key: key(), name: '', amount: '', qty: 1 }],
    charges: [],
    feeRules: {},
    splitMode: 'items',
    tip: { mode: 'none' },
    warnings: [],
    ...extra,
  };
}

function defaultTitle(source: BillSource): string {
  const names: Partial<Record<BillSource, string>> = {
    swiggy: 'Swiggy order',
    zomato: 'Zomato order',
    instamart: 'Instamart order',
    zepto: 'Zepto order',
    blinkit: 'Blinkit order',
    district: 'Dinner booked on District',
    eazydiner: 'EazyDiner booking',
    email: 'Order from email',
  };
  const d = new Date();
  return names[source] ?? `Bill on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}
