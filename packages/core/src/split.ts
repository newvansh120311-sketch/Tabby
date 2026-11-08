import { allocate } from './money';
import { BillInput, ChargeType, DEFAULT_FEE_RULES, FeeRule } from './types';

export const UNCLAIMED = '__unclaimed__';

export interface ParticipantShare {
  participantId: string;
  itemsMinor: number;
  /** chargeId -> this person's part of it */
  charges: Record<string, number>;
  chargesMinor: number;
  totalMinor: number;
}

export interface SplitResult {
  shares: ParticipantShare[];
  /** Items nobody has claimed yet. */
  unclaimedItemIds: string[];
  /** Cost of unclaimed items plus their proportional part of tax, discounts and so on. */
  unclaimedMinor: number;
  itemsTotalMinor: number;
  chargesTotalMinor: number;
  totalMinor: number;
}

export function ruleFor(type: ChargeType, rules?: BillInput['feeRules']): FeeRule {
  return rules?.[type] ?? DEFAULT_FEE_RULES[type];
}

export function computeSplit(bill: BillInput): SplitResult {
  const ids = bill.participants.map((p) => p.id);
  const itemsTotalMinor = bill.items.reduce((a, i) => a + i.amountMinor, 0);
  const chargesTotalMinor = bill.charges.reduce((a, c) => a + c.amountMinor, 0);
  const totalMinor = itemsTotalMinor + chargesTotalMinor;

  const shares = new Map<string, ParticipantShare>(
    ids.map((id) => [id, { participantId: id, itemsMinor: 0, charges: {}, chargesMinor: 0, totalMinor: 0 }]),
  );

  if (ids.length === 0) {
    return {
      shares: [],
      unclaimedItemIds: bill.items.map((i) => i.id),
      unclaimedMinor: totalMinor,
      itemsTotalMinor,
      chargesTotalMinor,
      totalMinor,
    };
  }

  if (bill.splitMode === 'even') {
    const itemParts = allocate(itemsTotalMinor, ids.map(() => 1));
    ids.forEach((id, k) => (shares.get(id)!.itemsMinor = itemParts[k]));
    for (const c of bill.charges) {
      const parts = allocate(c.amountMinor, ids.map(() => 1));
      ids.forEach((id, k) => (shares.get(id)!.charges[c.id] = parts[k]));
    }
    return finish(shares, [], 0, itemsTotalMinor, chargesTotalMinor, totalMinor);
  }

  const known = new Set(ids);
  const claimersByItem = new Map<string, string[]>();
  for (const cl of bill.claims) {
    if (!known.has(cl.participantId)) continue;
    const list = claimersByItem.get(cl.itemId) ?? [];
    if (!list.includes(cl.participantId)) list.push(cl.participantId);
    claimersByItem.set(cl.itemId, list);
  }

  let unclaimedItemsMinor = 0;
  const unclaimedItemIds: string[] = [];
  for (const item of bill.items) {
    // Keep claimer order stable so remainders land predictably.
    const claimers = (claimersByItem.get(item.id) ?? []).sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
    if (claimers.length === 0) {
      unclaimedItemsMinor += item.amountMinor;
      unclaimedItemIds.push(item.id);
      continue;
    }
    const parts = allocate(item.amountMinor, claimers.map(() => 1));
    claimers.forEach((pid, k) => (shares.get(pid)!.itemsMinor += parts[k]));
  }

  const claimants = ids.filter((id) => shares.get(id)!.itemsMinor !== 0 || hasClaim(bill, id));
  let unclaimedChargesMinor = 0;

  for (const c of bill.charges) {
    const rule = ruleFor(c.type, bill.feeRules);
    if (rule === 'proportional') {
      // Unclaimed items carry their own part, so shares don't jump around as people claim.
      let weights = [...ids.map((id) => Math.abs(shares.get(id)!.itemsMinor)), Math.abs(unclaimedItemsMinor)];
      if (weights.every((w) => w === 0)) weights = [...ids.map(() => 1), 0];
      const parts = allocate(c.amountMinor, weights);
      ids.forEach((id, k) => (shares.get(id)!.charges[c.id] = parts[k]));
      unclaimedChargesMinor += parts[ids.length];
    } else {
      const group = rule === 'claims' && claimants.length > 0 ? claimants : ids;
      const parts = allocate(c.amountMinor, group.map(() => 1));
      ids.forEach((id) => (shares.get(id)!.charges[c.id] = 0));
      group.forEach((id, k) => (shares.get(id)!.charges[c.id] = parts[k]));
    }
  }

  return finish(
    shares,
    unclaimedItemIds,
    unclaimedItemsMinor + unclaimedChargesMinor,
    itemsTotalMinor,
    chargesTotalMinor,
    totalMinor,
  );
}

function hasClaim(bill: BillInput, pid: string) {
  return bill.claims.some((c) => c.participantId === pid);
}

function finish(
  shares: Map<string, ParticipantShare>,
  unclaimedItemIds: string[],
  unclaimedMinor: number,
  itemsTotalMinor: number,
  chargesTotalMinor: number,
  totalMinor: number,
): SplitResult {
  const list = [...shares.values()].map((s) => {
    const chargesMinor = Object.values(s.charges).reduce((a, b) => a + b, 0);
    return { ...s, chargesMinor, totalMinor: s.itemsMinor + chargesMinor };
  });
  return { shares: list, unclaimedItemIds, unclaimedMinor, itemsTotalMinor, chargesTotalMinor, totalMinor };
}

/** Sum of items and charges compared with a total read off the receipt. */
export function checkTotals(
  items: { amountMinor: number }[],
  charges: { amountMinor: number }[],
  detectedTotalMinor?: number,
): { computedMinor: number; differenceMinor: number; matches: boolean } {
  const computedMinor =
    items.reduce((a, i) => a + i.amountMinor, 0) + charges.reduce((a, c) => a + c.amountMinor, 0);
  if (detectedTotalMinor == null) return { computedMinor, differenceMinor: 0, matches: true };
  const differenceMinor = computedMinor - detectedTotalMinor;
  return { computedMinor, differenceMinor, matches: Math.abs(differenceMinor) <= 1 };
}

/** Build a charge amount from a tip setting. Percent tips apply to the item subtotal. */
export function tipAmount(
  itemsTotalMinor: number,
  tip: { mode: 'percent'; percent: number } | { mode: 'fixed'; amountMinor: number },
): number {
  if (tip.mode === 'fixed') return Math.round(tip.amountMinor);
  return Math.round((itemsTotalMinor * tip.percent) / 100);
}
