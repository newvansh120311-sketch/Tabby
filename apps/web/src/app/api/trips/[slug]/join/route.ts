import { tripJoinSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, Ctx, json, route } from '@/lib/http';
import { hashToken, identify } from '@/lib/identity';
import { loadTrip, serializeTrip } from '@/lib/trips';
import { originOf } from '@/lib/origin';

/** Join a trip, either as a new member or by taking over a name the owner already added. */
export const POST = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const input = await body(req, tripJoinSchema);
  const tokenHash = hashToken(input.deviceToken);
  const trip = await loadTrip(slug);

  const existing = trip.members.find((m) => m.deviceTokenHash === tokenHash || (who.userId && m.userId === who.userId));
  const seat = input.memberId ? trip.members.find((m) => m.id === input.memberId && !m.deviceTokenHash && !m.userId) : undefined;
  const target = existing ?? seat;
  let memberId: string;
  if (target) {
    await db.tripMember.update({
      where: { id: target.id },
      data: {
        name: input.name,
        deviceTokenHash: tokenHash,
        userId: who.userId ?? target.userId,
        upiId: input.upiId || target.upiId,
      },
    });
    memberId = target.id;
  } else {
    const m = await db.tripMember.create({
      data: { tripId: trip.id, name: input.name, deviceTokenHash: tokenHash, userId: who.userId, upiId: input.upiId || null },
    });
    memberId = m.id;
  }
  // Seat the member on bills already in the trip, so claims and even splits include them.
  await db.participant.updateMany({ where: { memberId }, data: { deviceTokenHash: tokenHash, name: input.name } });
  for (const b of trip.bills) {
    if (!b.participants.some((p) => p.memberId === memberId)) {
      await db.participant.create({ data: { billId: b.id, memberId, name: input.name, deviceTokenHash: tokenHash } });
    }
  }
  await db.trip.update({ where: { id: trip.id }, data: { updatedAt: new Date() } });
  const fresh = await loadTrip(slug);
  return json({ trip: serializeTrip(fresh, { ...who, deviceHash: tokenHash }, originOf(req)) });
});
