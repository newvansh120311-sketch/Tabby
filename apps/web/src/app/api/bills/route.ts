import { NEGATIVE_CHARGE_TYPES, billWriteSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { billInclude, serializeBill, syncBillSettlements, uniqueSlug } from '@/lib/bills';
import { originOf } from '@/lib/origin';

/** Bills I host or joined, newest first. */
export const GET = route(async (req) => {
  const who = await identify(req);
  if (!who.deviceHash && !who.userId) return json({ bills: [] });
  const or = [
    ...(who.userId ? [{ ownerId: who.userId }] : []),
    ...(who.deviceHash ? [{ ownerDeviceHash: who.deviceHash }, { participants: { some: { deviceTokenHash: who.deviceHash } } }] : []),
  ];
  const bills = await db.bill.findMany({
    where: { OR: or, tripId: null },
    include: billInclude,
    orderBy: { date: 'desc' },
    take: 100,
  });
  const origin = originOf(req);
  return json({ bills: bills.map((b) => serializeBill(b, who, origin)) });
});

export const POST = route(async (req) => {
  const who = await identify(req);
  if (!who.deviceHash) throw new HttpError(400, 'Missing device token.');
  const input = await body(req, billWriteSchema);
  const user = who.userId ? await db.user.findUnique({ where: { id: who.userId } }) : null;
  const device = await db.device.findUnique({ where: { tokenHash: who.deviceHash } });

  let tripMembers: { id: string; name: string; deviceTokenHash: string | null }[] = [];
  if (input.tripId) {
    const trip = await db.trip.findUnique({ where: { id: input.tripId }, include: { members: true } });
    if (!trip) throw new HttpError(404, 'That trip no longer exists.');
    const isMember = trip.members.some((m) => m.deviceTokenHash === who.deviceHash || (who.userId && m.userId === who.userId));
    if (!isMember) throw new HttpError(403, 'Join the trip before adding bills to it.');
    if (!input.payerMemberId || !trip.members.some((m) => m.id === input.payerMemberId))
      throw new HttpError(422, 'Pick who paid for this bill.');
    tripMembers = trip.members;
  }

  const hostName = input.hostName ?? user?.displayName ?? device?.displayName ?? user?.name ?? 'Host';
  const hostUpiId = input.hostUpiId || user?.upiId || device?.upiId || null;
  const slug = await uniqueSlug('bill');

  const bill = await db.bill.create({
    data: {
      slug,
      title: input.title,
      merchant: input.merchant,
      currency: input.currency,
      source: input.source,
      splitMode: input.splitMode,
      feeRules: input.feeRules,
      date: input.date ? new Date(input.date) : new Date(),
      detectedTotalMinor: input.detectedTotalMinor,
      tripId: input.tripId,
      payerMemberId: input.payerMemberId,
      fxRateToBase: input.fxRateToBase ?? 1,
      ownerId: who.userId,
      ownerDeviceHash: who.deviceHash,
      hostName: input.tripId ? null : hostName,
      hostUpiId: input.tripId ? null : hostUpiId,
      items: { create: input.items.map((i, k) => ({ name: i.name, amountMinor: i.amountMinor, qty: i.qty, position: k })) },
      charges: {
        create: input.charges.map((c, k) => ({
          type: c.type,
          label: c.label || c.type,
          amountMinor: NEGATIVE_CHARGE_TYPES.includes(c.type) ? -Math.abs(c.amountMinor) : c.amountMinor,
          position: k,
        })),
      },
      participants: {
        create: input.tripId
          ? // Trip bills start with every member so even splits and claims just work.
            tripMembers.map((m) => ({ name: m.name, memberId: m.id, deviceTokenHash: m.deviceTokenHash, isHost: m.id === input.payerMemberId }))
          : [
              { name: hostName, deviceTokenHash: who.deviceHash, isHost: true },
              ...input.participants.map((p) => ({ name: p.name })),
            ],
      },
    },
    include: billInclude,
  });
  await syncBillSettlements(bill);
  const fresh = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: billInclude });
  return json({ bill: serializeBill(fresh, who, originOf(req)) }, 201);
});
