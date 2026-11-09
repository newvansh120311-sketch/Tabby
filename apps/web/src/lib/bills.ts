import { Prisma } from '@prisma/client';
import { buildUpiUri, computeSplit, FeeRules, isValidVpa, randomSlug, SOURCE_LABELS, upiNote } from '@tabby/core';
import { db } from './db';
import { HttpError } from './http';
import { Identity } from './identity';

export const billInclude = {
  items: { orderBy: { position: 'asc' }, include: { claims: true } },
  charges: { orderBy: { position: 'asc' } },
  participants: { orderBy: { createdAt: 'asc' } },
  settlements: true,
  trip: { select: { id: true, slug: true, name: true, baseCurrency: true, ownerId: true, ownerDeviceHash: true } },
  payer: true,
} satisfies Prisma.BillInclude;

export type BillRow = Prisma.BillGetPayload<{ include: typeof billInclude }>;

export async function uniqueSlug(kind: 'bill' | 'trip'): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const slug = randomSlug(6);
    const taken =
      kind === 'bill'
        ? await db.bill.findUnique({ where: { slug }, select: { id: true } })
        : await db.trip.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  throw new HttpError(500, 'Couldn’t pick a link for this. Try again.');
}

export async function loadBill(slug: string): Promise<BillRow> {
  const bill = await db.bill.findUnique({ where: { slug }, include: billInclude });
  if (!bill) throw new HttpError(404, 'We couldn’t find that bill. The link may be mistyped.');
  return bill;
}

export function isBillHost(bill: BillRow, who: Identity): boolean {
  if (who.userId && (bill.ownerId === who.userId || bill.trip?.ownerId === who.userId)) return true;
  if (who.deviceHash && (bill.ownerDeviceHash === who.deviceHash || bill.trip?.ownerDeviceHash === who.deviceHash)) return true;
  // In a trip, the member who paid can manage that bill too.
  if (who.deviceHash && bill.payer?.deviceTokenHash === who.deviceHash) return true;
  if (who.userId && bill.payer?.userId === who.userId) return true;
  return false;
}

export function requireHost(bill: BillRow, who: Identity) {
  if (!isBillHost(bill, who)) throw new HttpError(403, 'Only the person who paid can change this bill.');
}

/** Payee details for the bill: the payer member in a trip, otherwise the host. */
function payee(bill: BillRow) {
  if (bill.payer) return { name: bill.payer.name, upiId: bill.payer.upiId };
  return { name: bill.hostName ?? 'Host', upiId: bill.hostUpiId };
}

export function serializeBill(bill: BillRow, who: Identity, origin: string) {
  const host = bill.participants.find((p) => p.isHost);
  const split = computeSplit({
    currency: bill.currency,
    splitMode: bill.splitMode,
    items: bill.items.map((i) => ({ id: i.id, amountMinor: i.amountMinor, qty: i.qty })),
    charges: bill.charges.map((c) => ({ id: c.id, type: c.type, amountMinor: c.amountMinor })),
    participants: bill.participants.map((p) => ({ id: p.id })),
    claims: bill.items.flatMap((i) => i.claims.map((c) => ({ itemId: c.itemId, participantId: c.participantId }))),
    feeRules: (bill.feeRules ?? {}) as FeeRules,
  });
  const { name: payeeName, upiId: payeeUpi } = payee(bill);
  const upiOk = bill.currency === 'INR' && !!payeeUpi && isValidVpa(payeeUpi);
  const me = bill.participants.find(
    (p) => (who.deviceHash && p.deviceTokenHash === who.deviceHash) || false,
  );
  const settlementFor = (pid: string) => bill.settlements.find((s) => s.fromId === pid);
  const payeeParticipantId = bill.payer
    ? bill.participants.find((p) => p.memberId === bill.payerMemberId)?.id
    : host?.id;

  return {
    id: bill.id,
    slug: bill.slug,
    url: `${origin}/b/${bill.slug}`,
    title: bill.title,
    merchant: bill.merchant,
    source: bill.source,
    sourceLabel: SOURCE_LABELS[bill.source],
    currency: bill.currency,
    fxRateToBase: bill.fxRateToBase,
    splitMode: bill.splitMode,
    feeRules: bill.feeRules,
    date: bill.date.toISOString(),
    detectedTotalMinor: bill.detectedTotalMinor,
    isDemo: bill.isDemo,
    version: bill.version,
    updatedAt: bill.updatedAt.toISOString(),
    trip: bill.trip ? { slug: bill.trip.slug, name: bill.trip.name, baseCurrency: bill.trip.baseCurrency } : null,
    payerMemberId: bill.payerMemberId,
    payee: { name: payeeName, upiId: upiOk ? payeeUpi : null, participantId: payeeParticipantId ?? null },
    isHost: isBillHost(bill, who),
    meParticipantId: me?.id ?? null,
    items: bill.items.map((i) => ({
      id: i.id,
      name: i.name,
      amountMinor: i.amountMinor,
      qty: i.qty,
      claimedBy: i.claims.map((c) => c.participantId),
    })),
    charges: bill.charges.map((c) => ({ id: c.id, type: c.type, label: c.label, amountMinor: c.amountMinor })),
    participants: bill.participants.map((p) => {
      const share = split.shares.find((s) => s.participantId === p.id)!;
      const st = settlementFor(p.id);
      const owes = p.id !== payeeParticipantId && share.totalMinor > 0;
      return {
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        memberId: p.memberId,
        itemsMinor: share.itemsMinor,
        chargesMinor: share.chargesMinor,
        charges: share.charges,
        totalMinor: share.totalMinor,
        status: owes ? (st?.status ?? 'unpaid') : null,
        settlementId: st?.id ?? null,
        upiUri:
          owes && upiOk && !bill.tripId
            ? buildUpiUri({ vpa: payeeUpi!, name: payeeName, amountMinor: share.totalMinor, note: upiNote(bill.title) })
            : null,
      };
    }),
    totals: {
      itemsMinor: split.itemsTotalMinor,
      chargesMinor: split.chargesTotalMinor,
      totalMinor: split.totalMinor,
      unclaimedMinor: split.unclaimedMinor,
      unclaimedItemIds: split.unclaimedItemIds,
    },
  };
}

export type BillView = ReturnType<typeof serializeBill>;

export async function bumpBill(billId: string) {
  await db.bill.update({ where: { id: billId }, data: { version: { increment: 1 } } });
}

/** Keep bill settlements (payer <- each participant) in step with current shares. */
export async function syncBillSettlements(bill: BillRow) {
  if (bill.tripId) return; // trip bills settle at trip level
  const view = serializeBill(bill, { deviceHash: null, userId: null }, '');
  const payeeId = view.payee.participantId;
  if (!payeeId) return;
  for (const p of view.participants) {
    const existing = bill.settlements.find((s) => s.fromId === p.id);
    if (p.id === payeeId || p.totalMinor <= 0) {
      if (existing && existing.status === 'unpaid') await db.settlement.delete({ where: { id: existing.id } });
      continue;
    }
    if (!existing) {
      await db.settlement.create({
        data: { billId: bill.id, fromId: p.id, toId: payeeId, amountMinor: p.totalMinor, currency: bill.currency },
      });
    } else if (existing.amountMinor !== p.totalMinor) {
      // A changed amount means the earlier "paid" no longer matches; ask again.
      await db.settlement.update({
        where: { id: existing.id },
        data: { amountMinor: p.totalMinor, status: existing.status === 'confirmed' ? 'confirmed' : 'unpaid' },
      });
    }
  }
}
