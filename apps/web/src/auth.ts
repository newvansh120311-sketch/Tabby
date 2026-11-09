import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';

// Web sessions (used on /account). The Android app signs in natively and
// exchanges its Google ID token at /api/mobile/google instead.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: process.env.AUTH_GOOGLE_ID ? [Google] : [],
  session: { strategy: 'database' },
  trustHost: true,
});
