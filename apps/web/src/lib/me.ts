import type { Device, User } from '@prisma/client';

export function serializeMe(user: User | null, device: Device | null) {
  return {
    signedIn: !!user,
    email: user?.email ?? null,
    image: user?.image ?? null,
    displayName: user?.displayName ?? device?.displayName ?? user?.name ?? null,
    defaultCurrency: user?.defaultCurrency ?? device?.defaultCurrency ?? 'INR',
    upiId: user?.upiId ?? device?.upiId ?? null,
    isDemo: user?.isDemo ?? false,
  };
}
