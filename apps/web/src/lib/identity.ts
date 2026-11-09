import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { db } from './db';

export interface Identity {
  /** sha256 of the device token, or null when the request had none. */
  deviceHash: string | null;
  userId: string | null;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-only-secret');

/** Session token for the Android app after Google sign-in. */
export async function signAppToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, typ: 'tabby-app' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('180d')
    .sign(secret());
}

async function verifyAppToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.typ === 'tabby-app' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Who is calling. The app and the guest page both send x-device-token (a random string
 * they keep locally); a signed-in app also sends a bearer token.
 */
export async function identify(req: Request): Promise<Identity> {
  const device = req.headers.get('x-device-token');
  const deviceHash = device && device.length >= 16 && device.length <= 128 ? hashToken(device) : null;
  const auth = req.headers.get('authorization');
  const userId = auth?.startsWith('Bearer ') ? await verifyAppToken(auth.slice(7)) : null;
  if (deviceHash) {
    await db.device
      .upsert({
        where: { tokenHash: deviceHash },
        create: { tokenHash: deviceHash, userId },
        update: { lastSeenAt: new Date(), ...(userId ? { userId } : {}) },
      })
      .catch(() => undefined);
  }
  return { deviceHash, userId };
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
}

/** Verify an ID token from native Google sign-in. Its audience is the web client ID. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const audience = [process.env.AUTH_GOOGLE_ID, process.env.GOOGLE_ANDROID_CLIENT_ID].filter(Boolean) as string[];
  if (audience.length === 0) throw new Error('Google sign-in is not configured');
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  });
  return {
    sub: String(payload.sub),
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
    emailVerified: payload.email_verified === true,
  };
}
