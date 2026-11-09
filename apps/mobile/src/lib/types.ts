// Shapes returned by the Tabby API (see apps/web/src/lib/bills.ts and trips.ts).
import type { BillSource, ChargeType, FeeRules } from '@tabby/core';

export type PayStatus = 'unpaid' | 'marked' | 'confirmed';

export interface BillView {
  id: string;
  slug: string;
  url: string;
  title: string;
  merchant: string | null;
  source: BillSource;
  sourceLabel: string;
  currency: string;
  fxRateToBase: number;
  splitMode: 'items' | 'even';
  feeRules: FeeRules;
  date: string;
  detectedTotalMinor: number | null;
  isDemo: boolean;
  version: number;
  updatedAt: string;
  trip: { slug: string; name: string; baseCurrency: string } | null;
  payerMemberId: string | null;
  payee: { name: string; upiId: string | null; participantId: string | null };
  isHost: boolean;
  meParticipantId: string | null;
  items: { id: string; name: string; amountMinor: number; qty: number; claimedBy: string[] }[];
  charges: { id: string; type: ChargeType; label: string; amountMinor: number }[];
  participants: {
    id: string;
    name: string;
    isHost: boolean;
    memberId: string | null;
    itemsMinor: number;
    chargesMinor: number;
    totalMinor: number;
    status: PayStatus | null;
    settlementId: string | null;
    upiUri: string | null;
  }[];
  totals: { itemsMinor: number; chargesMinor: number; totalMinor: number; unclaimedMinor: number; unclaimedItemIds: string[] };
  /** Set on bills created offline that haven't reached the server yet. */
  pending?: boolean;
}

export interface TripView {
  id: string;
  slug: string;
  url: string;
  name: string;
  baseCurrency: string;
  isDemo: boolean;
  settledAt: string | null;
  updatedAt: string;
  isOwner: boolean;
  meMemberId: string | null;
  members: { id: string; name: string; isOwner: boolean; hasUpi: boolean; joined: boolean }[];
  balances: { memberId: string; name: string; paidMinor: number; owedMinor: number; settledMinor: number; netMinor: number }[];
  payments: {
    fromMemberId: string;
    toMemberId: string;
    fromName: string;
    toName: string;
    amountMinor: number;
    settlementId: string | null;
    status: PayStatus;
    upiUri: string | null;
  }[];
  confirmedPayments: { id: string; fromName: string; toName: string; amountMinor: number }[];
  bills: {
    slug: string;
    title: string;
    source: BillSource;
    sourceLabel: string;
    date: string;
    currency: string;
    fxRateToBase: number;
    splitMode: 'items' | 'even';
    totalMinor: number;
    totalBaseMinor: number;
    payerMemberId: string | null;
    payerName: string;
  }[];
}

export interface Me {
  signedIn: boolean;
  email: string | null;
  image: string | null;
  displayName: string | null;
  defaultCurrency: string;
  upiId: string | null;
  isDemo: boolean;
}
