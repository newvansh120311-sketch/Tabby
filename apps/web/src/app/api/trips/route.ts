import { tripCreateSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { uniqueSlug } from '@/lib/bills';
import { loadTrip, serializeTrip, tripInclude } from '@/lib/trips';
import { originOf } from '@/lib/origin';

export const GET = route(async (req) => {
  const who = await identify(req);
  if (!who.deviceHash && !who.userId) return json({ trips: [] });
  const trips = await db.trip.findMany({
    where: {
      OR: [
        ...(who.userId ? [{ ownerId: who.userId }, { members: { some: { userId: who.userId } } }] : []),
        ...(who.deviceHash ? [{ ownerDeviceHash: who.deviceHash }, { members: { some: { deviceTokenHash: who.deviceHash } } }] : []),
      ],
    },
    include: tripInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const origin = originOf(req);
  return json({ trips: trips.map((t) => serializeTrip(t, who, origin)) });
});

export const POST = route(async (req) => {
  const who = await identify(req);
  if (!who.deviceHash) throw new HttpError(400, 'Missing device token.');
  const input = await body(req, tripCreateSchema);
  const user = who.userId ? await db.user.findUnique({ where: { id: who.userId } }) : null;
  const device = await db.device.findUnique({ where: { tokenHash: who.deviceHash } });
  const slug = await uniqueSlug('trip');
  const trip = await db.trip.create({
    data: {
      slug,
      name: input.name,
      baseCurrency: input.baseCurrency,
      ownerId: who.userId,
      ownerDeviceHash: who.deviceHash,
      members: {
        create: {
          name: input.ownerName,
          userId: who.userId,
          deviceTokenHash: who.deviceHash,
          upiId: input.ownerUpiId || user?.upiId || device?.upiId || null,
          isOwner: true,
        },
      },
    },
  });
  const full = await loadTrip(trip.slug);
  return json({ trip: serializeTrip(full, who, originOf(req)) }, 201);
});
