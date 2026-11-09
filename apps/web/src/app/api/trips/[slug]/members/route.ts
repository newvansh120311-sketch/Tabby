import { upiIdSchema } from '@tabby/core';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, Ctx, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { loadTrip, serializeTrip } from '@/lib/trips';
import { originOf } from '@/lib/origin';

const schema = z.object({
  add: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  /** Update my own UPI ID on this trip. */
  myUpiId: upiIdSchema.optional().or(z.literal('')),
});

export const POST = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const trip = await loadTrip(slug);
  const view = serializeTrip(trip, who, originOf(req));
  if (!view.meMemberId) throw new HttpError(403, 'Join the trip first.');
  const input = await body(req, schema);
  for (const name of input.add) {
    const m = await db.tripMember.create({ data: { tripId: trip.id, name } });
    for (const b of trip.bills) await db.participant.create({ data: { billId: b.id, memberId: m.id, name } });
  }
  if (input.myUpiId !== undefined) {
    await db.tripMember.update({ where: { id: view.meMemberId }, data: { upiId: input.myUpiId || null } });
  }
  await db.trip.update({ where: { id: trip.id }, data: { updatedAt: new Date() } });
  const fresh = await loadTrip(slug);
  return json({ trip: serializeTrip(fresh, who, originOf(req)) });
});
