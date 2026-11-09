import { settingsSchema } from '@tabby/core';
import { db } from '@/lib/db';
import { body, HttpError, json, route } from '@/lib/http';
import { identify } from '@/lib/identity';
import { serializeMe } from '@/lib/me';

export const GET = route(async (req) => {
  const who = await identify(req);
  const user = who.userId ? await db.user.findUnique({ where: { id: who.userId } }) : null;
  const device = who.deviceHash ? await db.device.findUnique({ where: { tokenHash: who.deviceHash } }) : null;
  return json({ me: serializeMe(user, device), googleConfigured: !!process.env.AUTH_GOOGLE_ID });
});

/** Settings live on the account when signed in, otherwise on this device. */
export const PUT = route(async (req) => {
  const who = await identify(req);
  if (!who.deviceHash && !who.userId) throw new HttpError(400, 'Missing device token.');
  const input = await body(req, settingsSchema);
  const data = { displayName: input.displayName, defaultCurrency: input.defaultCurrency, upiId: input.upiId || null };
  let user = null;
  if (who.userId) user = await db.user.update({ where: { id: who.userId }, data });
  const device = who.deviceHash
    ? await db.device.update({ where: { tokenHash: who.deviceHash }, data })
    : null;
  // Keep trip seats in step so settle-up uses the new UPI ID.
  const memberWhere = who.userId ? { userId: who.userId } : { deviceTokenHash: who.deviceHash! };
  await db.tripMember.updateMany({ where: memberWhere, data: { upiId: data.upiId } });
  return json({ me: serializeMe(user, device) });
});
