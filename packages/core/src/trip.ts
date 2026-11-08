import { allocate, convertMinor } from './money';
import { BillInput } from './types';
import { computeSplit } from './split';

export interface TripBillInput {
  id: string;
  payerMemberId: string;
  currency: string;
  /** 1 unit of the bill currency = fxRateToBase units of the trip base currency. */
  fxRateToBase: number;
  totalMinor: number;
  /** memberId -> owed amount in the bill currency. Must sum to totalMinor. */
  owedByMember: Record<string, number>;
}

export interface TripSettlementInput {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  status: 'unpaid' | 'marked' | 'confirmed';
}

export interface MemberBalance {
  memberId: string;
  paidMinor: number;
  owedMinor: number;
  /** Confirmed settle-up payments: + sent, - received. */
  settledMinor: number;
  /** paid - owed + settled. Positive means others owe this member. */
  netMinor: number;
}

export interface TripInput {
  baseCurrency: string;
  memberIds: string[];
  bills: TripBillInput[];
  settlements?: TripSettlementInput[];
}

/**
 * Turn a bill and its participants into what each trip member owes.
 * participantMember maps participantId -> memberId. Unclaimed items and
 * participants without a member fall on the payer.
 */
export function tripOwedFromBill(
  bill: BillInput,
  payerMemberId: string,
  participantMember: Record<string, string | null | undefined>,
): { totalMinor: number; owedByMember: Record<string, number> } {
  const split = computeSplit(bill);
  const owed: Record<string, number> = {};
  const add = (m: string, v: number) => (owed[m] = (owed[m] ?? 0) + v);
  for (const s of split.shares) add(participantMember[s.participantId] ?? payerMemberId, s.totalMinor);
  if (split.unclaimedMinor) add(payerMemberId, split.unclaimedMinor);
  return { totalMinor: split.totalMinor, owedByMember: owed };
}

export function computeTripBalances(trip: TripInput): MemberBalance[] {
  const bal = new Map<string, MemberBalance>(
    trip.memberIds.map((id) => [id, { memberId: id, paidMinor: 0, owedMinor: 0, settledMinor: 0, netMinor: 0 }]),
  );
  const get = (id: string) => {
    if (!bal.has(id)) bal.set(id, { memberId: id, paidMinor: 0, owedMinor: 0, settledMinor: 0, netMinor: 0 });
    return bal.get(id)!;
  };

  for (const bill of trip.bills) {
    const totalBase =
      bill.currency === trip.baseCurrency
        ? bill.totalMinor
        : convertMinor(bill.totalMinor, bill.currency, trip.baseCurrency, bill.fxRateToBase);
    get(bill.payerMemberId).paidMinor += totalBase;
    // Convert the bill total once, then spread it, so converted shares add up to exactly what was paid.
    const members = Object.keys(bill.owedByMember);
    const weights = members.map((m) => bill.owedByMember[m]);
    const parts = allocateSigned(totalBase, weights);
    members.forEach((m, k) => (get(m).owedMinor += parts[k]));
  }

  for (const s of trip.settlements ?? []) {
    if (s.status !== 'confirmed') continue;
    get(s.fromMemberId).settledMinor += s.amountMinor;
    get(s.toMemberId).settledMinor -= s.amountMinor;
  }

  return [...bal.values()].map((b) => ({ ...b, netMinor: b.paidMinor - b.owedMinor + b.settledMinor }));
}

/** Like allocate, but tolerates weights of mixed sign (a member whose discount exceeds their items). */
function allocateSigned(total: number, weights: number[]): number[] {
  if (weights.every((w) => w >= 0)) return allocate(total, weights);
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW === 0) return allocate(total, weights.map(() => 1));
  const raw = weights.map((w) => (total * w) / sumW);
  const parts = raw.map((r) => Math.round(r));
  let diff = total - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0; i = (i + 1) % parts.length) {
    const step = Math.sign(diff);
    parts[i] += step;
    diff -= step;
  }
  return parts;
}

export interface Payment {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

/**
 * Greedy settle-up: the biggest debtor pays the biggest creditor until everyone is even.
 * Each step zeroes at least one member, so there are at most n-1 payments.
 */
export function simplifyDebts(balances: { memberId: string; netMinor: number }[]): Payment[] {
  const sum = balances.reduce((a, b) => a + b.netMinor, 0);
  if (sum !== 0) throw new Error(`simplifyDebts: balances must sum to zero (got ${sum})`);
  const creditors = balances.filter((b) => b.netMinor > 0).map((b) => ({ id: b.memberId, amt: b.netMinor }));
  const debtors = balances.filter((b) => b.netMinor < 0).map((b) => ({ id: b.memberId, amt: -b.netMinor }));
  const payments: Payment[] = [];
  const byAmount = (a: { id: string; amt: number }, b: { id: string; amt: number }) =>
    b.amt - a.amt || a.id.localeCompare(b.id);
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0];
    const d = debtors[0];
    const amt = Math.min(c.amt, d.amt);
    payments.push({ fromMemberId: d.id, toMemberId: c.id, amountMinor: amt });
    c.amt -= amt;
    d.amt -= amt;
    if (c.amt === 0) creditors.shift();
    if (d.amt === 0) debtors.shift();
  }
  return payments;
}
