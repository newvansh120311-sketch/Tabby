import { Prisma } from '@prisma/client';
import {
  buildUpiUri,
  computeTripBalances,
  convertMinor,
  FeeRules,
  isValidVpa,
  simplifyDebts,
  SOURCE_LABELS,
  tripOwedFromBill,
  upiNote,
} from '@tabby/core';
import { db } from './db';
import { HttpError } from './http';
import { Identity } from './identity';

export const tripInclude = {
  members: { orderBy: { createdAt: 'asc' } },
  settlements: true,
  bills: {
    orderBy: { date: 'asc' },
    include: {
      items: { include: { claims: true } },
      charges: true,
      participants: true,
    },
  },
} satisfies Prisma.TripInclude;

export type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

export async function loadTrip(slug: string): Promise<TripRow> {
  const trip = await db.trip.findUnique({ where: { slug }, include: tripInclude });
  if (!trip) throw new HttpError(404, 'We couldn’t find that trip. The link may be mistyped.');
  return trip;
}

export async function tripRole(tripId: string, who: Identity) {
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, include: { members: true } });
  const member = trip.members.find(
    (m) => (who.deviceHash && m.deviceTokenHash === who.deviceHash) || (who.userId && m.userId === who.userId),
  );
  const isOwner =
    (!!who.userId && trip.ownerId === who.userId) || (!!who.deviceHash && trip.ownerDeviceHash === who.deviceHash);
  return { memberId: member?.id ?? null, isOwner };
}

function billOwed(bill: TripRow['bills'][number]) {
  const payer = bill.payerMemberId ?? bill.participants.find((p) => p.isHost)?.memberId ?? '';
  const participantMember = Object.fromEntries(bill.participants.map((p) => [p.id, p.memberId]));
  return tripOwedFromBill(
    {
      currency: bill.currency,
      splitMode: bill.splitMode,
      items: bill.items.map((i) => ({ id: i.id, amountMinor: i.amountMinor })),
      charges: bill.charges.map((c) => ({ id: c.id, type: c.type, amountMinor: c.amountMinor })),
      participants: bill.participants.map((p) => ({ id: p.id })),
      claims: bill.items.flatMap((i) => i.claims.map((c) => ({ itemId: c.itemId, participantId: c.participantId }))),
      feeRules: (bill.feeRules ?? {}) as FeeRules,
    },
    payer,
    participantMember,
  );
}

export function serializeTrip(trip: TripRow, who: Identity, origin: string) {
  const memberIds = trip.members.map((m) => m.id);
  const bills = trip.bills.map((b) => ({ row: b, ...billOwed(b) }));
  const settlements = trip.settlements.map((s) => ({
    fromMemberId: s.fromId,
    toMemberId: s.toId,
    amountMinor: s.amountMinor,
    status: s.status,
  }));
  const balances = computeTripBalances({
    baseCurrency: trip.baseCurrency,
    memberIds,
    bills: bills.map((b) => ({
      id: b.row.id,
      payerMemberId: b.row.payerMemberId ?? '',
      currency: b.row.currency,
      fxRateToBase: b.row.fxRateToBase,
      totalMinor: b.totalMinor,
      owedByMember: b.owedByMember,
    })),
    settlements,
  }).filter((b) => memberIds.includes(b.memberId));

  // Settle-up is computed from what's still owed after confirmed payments.
  const payments = simplifyDebts(balances.map((b) => ({ memberId: b.memberId, netMinor: b.netMinor })));
  const byId = new Map(trip.members.map((m) => [m.id, m]));
  const me = trip.members.find(
    (m) => (who.deviceHash && m.deviceTokenHash === who.deviceHash) || (who.userId && m.userId === who.userId),
  );
  const isOwner =
    (!!who.userId && trip.ownerId === who.userId) || (!!who.deviceHash && trip.ownerDeviceHash === who.deviceHash);

  const openSettlement = (from: string, to: string) =>
    trip.settlements.find((s) => s.fromId === from && s.toId === to && s.status !== 'confirmed');

  return {
    id: trip.id,
    slug: trip.slug,
    url: `${origin}/t/${trip.slug}`,
    name: trip.name,
    baseCurrency: trip.baseCurrency,
    isDemo: trip.isDemo,
    settledAt: trip.settledAt?.toISOString() ?? null,
    updatedAt: trip.updatedAt.toISOString(),
    isOwner,
    meMemberId: me?.id ?? null,
    members: trip.members.map((m) => ({
      id: m.id,
      name: m.name,
      isOwner: m.isOwner,
      hasUpi: !!m.upiId && isValidVpa(m.upiId),
      joined: !!m.deviceTokenHash || !!m.userId,
    })),
    balances: balances.map((b) => ({ ...b, name: byId.get(b.memberId)?.name ?? '?' })),
    payments: payments.map((p) => {
      const to = byId.get(p.toMemberId);
      const open = openSettlement(p.fromMemberId, p.toMemberId);
      const upiOk = trip.baseCurrency === 'INR' && !!to?.upiId && isValidVpa(to.upiId);
      return {
        ...p,
        fromName: byId.get(p.fromMemberId)?.name ?? '?',
        toName: to?.name ?? '?',
        settlementId: open?.id ?? null,
        status: open?.status ?? 'unpaid',
        upiUri: upiOk
          ? buildUpiUri({ vpa: to!.upiId!, name: to!.name, amountMinor: p.amountMinor, note: upiNote(trip.name) })
          : null,
      };
    }),
    confirmedPayments: trip.settlements
      .filter((s) => s.status === 'confirmed')
      .map((s) => ({
        id: s.id,
        fromName: byId.get(s.fromId)?.name ?? '?',
        toName: byId.get(s.toId)?.name ?? '?',
        amountMinor: s.amountMinor,
      })),
    bills: bills
      .map((b) => ({
        slug: b.row.slug,
        title: b.row.title,
        source: b.row.source,
        sourceLabel: SOURCE_LABELS[b.row.source],
        date: b.row.date.toISOString(),
        currency: b.row.currency,
        fxRateToBase: b.row.fxRateToBase,
        splitMode: b.row.splitMode,
        totalMinor: b.totalMinor,
        totalBaseMinor:
          b.row.currency === trip.baseCurrency
            ? b.totalMinor
            : convertMinor(b.totalMinor, b.row.currency, trip.baseCurrency, b.row.fxRateToBase),
        payerMemberId: b.row.payerMemberId,
        payerName: byId.get(b.row.payerMemberId ?? '')?.name ?? '?',
      }))
      .reverse(),
  };
}

export type TripView = ReturnType<typeof serializeTrip>;
