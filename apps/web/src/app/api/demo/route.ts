import { db } from '@/lib/db';
import { HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { createDemoTrip } from '@/lib/demo';
import { loadTrip, serializeTrip } from '@/lib/trips';
import { originOf } from '@/lib/origin';

/** Give this device its own copy of the demo trip to poke at, with them seated as Vivek. */
export const POST = route(async (req) => {
  const who = await identify(req);
  if (!who.deviceHash) throw new HttpError(400, 'Missing device token.');
  const existing = await db.trip.findFirst({ where: { isDemo: true, ownerDeviceHash: who.deviceHash } });
  const slug = existing
    ? existing.slug
    : (await createDemoTrip(db, { ownerId: who.userId, ownerDeviceHash: who.deviceHash, claimVivekForDevice: true })).slug;
  const trip = await loadTrip(slug);
  return json({ trip: serializeTrip(trip, who, originOf(req)) }, existing ? 200 : 201);
});
