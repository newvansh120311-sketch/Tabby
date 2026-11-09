import { z } from 'zod';
import { db } from '@/lib/db';
import { body, Ctx, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { loadTrip, serializeTrip } from '@/lib/trips';
import { originOf } from '@/lib/origin';

export const GET = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const trip = await loadTrip(slug);
  return json({ trip: serializeTrip(trip, who, originOf(req)) });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  settled: z.boolean().optional(),
});

export const PATCH = route(async (req, { params }: Ctx<{ slug: string }>) => {
  const { slug } = await params;
  const who = await identify(req);
  const trip = await loadTrip(slug);
  const view = serializeTrip(trip, who, originOf(req));
  if (!view.isOwner) throw new HttpError(403, 'Only the person who made the trip can change it.');
  const input = await body(req, patchSchema);
  if (input.settled && view.payments.length > 0)
    throw new HttpError(422, 'There are still payments to confirm before this trip is settled.');
  await db.trip.update({
    where: { id: trip.id },
    data: {
      name: input.name,
      settledAt: input.settled === undefined ? undefined : input.settled ? new Date() : null,
    },
  });
  const fresh = await loadTrip(slug);
  return json({ trip: serializeTrip(fresh, who, originOf(req)) });
});
