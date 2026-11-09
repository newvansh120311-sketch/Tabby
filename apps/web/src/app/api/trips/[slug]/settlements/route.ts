import { z } from 'zod';
import { db } from '@/lib/db';
import { body, Ctx, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { loadTrip, serializeTrip } from '@/lib/trips';
import { originOf } from '@/lib/origin';

const schema = z.object({
  fromMemberId: z.string(),
  toMemberId: z.string(),
  status: z.enum(['marked', 'confirmed']),
});

/**
 * Record progress on one of the suggested settle-up payments. The amount is taken from the
 * current suggestion, so a stale screen can't record the wrong number.
 */
export const POST = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const input = await body(req, schema);
  const trip = await loadTrip(slug);
  const view = serializeTrip(trip, who, originOf(req));
  const payment = view.payments.find((p) => p.fromMemberId === input.fromMemberId && p.toMemberId === input.toMemberId);
  if (!payment) throw new HttpError(409, 'Balances changed since you opened this. Pull to refresh and try again.');
  const me = view.meMemberId;
  const isDebtor = me === input.fromMemberId;
  const isCreditor = me === input.toMemberId || view.isOwner;
  if (input.status === 'confirmed' && !isCreditor) throw new HttpError(403, 'Only the person being paid can confirm this.');
  if (input.status === 'marked' && !isDebtor && !isCreditor) throw new HttpError(403, 'You can’t change this payment.');

  if (payment.settlementId) {
    await db.settlement.update({
      where: { id: payment.settlementId },
      data: { status: input.status, amountMinor: payment.amountMinor },
    });
  } else {
    await db.settlement.create({
      data: {
        tripId: trip.id,
        fromId: input.fromMemberId,
        toId: input.toMemberId,
        amountMinor: payment.amountMinor,
        currency: trip.baseCurrency,
        status: input.status,
      },
    });
  }
  await db.trip.update({ where: { id: trip.id }, data: { updatedAt: new Date() } });
  const fresh = await loadTrip(slug);
  return json({ trip: serializeTrip(fresh, who, originOf(req)) });
});
