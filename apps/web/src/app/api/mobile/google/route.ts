import { z } from 'zod';
import { db } from '@/lib/db';
import { body, HttpError, json, route } from '@/lib/http';
import { identify, signAppToken, verifyGoogleIdToken } from '@/lib/identity';
import { serializeMe } from '@/lib/me';

/** Exchange a Google ID token from native sign-in for a Tabby session token. */
export const POST = route(async (req) => {
  const { idToken } = await body(req, z.object({ idToken: z.string().min(20) }));
  const who = await identify(req);
  let profile;
  try {
    profile = await verifyGoogleIdToken(idToken);
  } catch {
    throw new HttpError(401, 'Google sign-in didn’t go through. Try again.');
  }

  const linked = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } },
  });
  const device = who.deviceHash ? await db.device.findUnique({ where: { tokenHash: who.deviceHash } }) : null;
  let userId = linked?.userId;
  if (!userId) {
    const byEmail = profile.email && profile.emailVerified ? await db.user.findUnique({ where: { email: profile.email } }) : null;
    const user =
      byEmail ??
      (await db.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          displayName: device?.displayName ?? profile.name?.split(' ')[0] ?? null,
          defaultCurrency: device?.defaultCurrency ?? 'INR',
          upiId: device?.upiId ?? null,
          emailVerified: profile.emailVerified ? new Date() : null,
        },
      }));
    await db.account.create({
      data: { userId: user.id, type: 'oidc', provider: 'google', providerAccountId: profile.sub },
    });
    userId = user.id;
  }
  if (who.deviceHash) {
    // Bills and trips made on this phone before signing in now belong to the account.
    await db.device.update({ where: { tokenHash: who.deviceHash }, data: { userId } });
    await db.bill.updateMany({ where: { ownerDeviceHash: who.deviceHash, ownerId: null }, data: { ownerId: userId } });
    await db.trip.updateMany({ where: { ownerDeviceHash: who.deviceHash, ownerId: null }, data: { ownerId: userId } });
    await db.tripMember.updateMany({ where: { deviceTokenHash: who.deviceHash, userId: null }, data: { userId } });
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return json({ token: await signAppToken(userId), me: serializeMe(user, null) });
});
