# Tabby build log

## 2026-11-08 Phase 0: Pre-flight
- Android package `app.tabby.split`. AUTH_SECRET generated.
- Release keystore created with keytool (eas credentials needed the token first). SHA-1 18:84:AE:DE:…:68:E0, SHA-256 2F:D6:EE:E8:…:E9:16.
- Verified: EXPO_TOKEN (account vans_lords), GitHub PAT (test push to newvansh120311-sketch/Tabby), Vercel token, Neon DATABASE_URL (PG 18.6), Google web + Android client ID formats.
- Created EAS project @vans_lords/tabby (461a0fc8-…), Vercel project tabby-split. Secrets stored in EAS env (keystore as base64 secret) and Vercel env. EXPO_TOKEN stored as GitHub Actions secret.
- Pivots: gh CLI absent, used PAT over HTTPS with a per-command auth header (token never written to git config). Remote already had a README commit; local commit replayed on top.
- Fallbacks: no custom domain (vercel.app subdomain), no Play Console (APK via /download + GitHub Release).
- Open: Google web client redirect URI must be added by the owner after first deploy.

## 2026-11-09 Phase 1: Foundation
- pnpm workspace with `apps/web`, `packages/core` (mobile next). Prisma schema with Auth.js tables plus Device, Trip, TripMember, Bill, Charge, Item, Participant, Claim, Settlement. Initial migration applied to Neon (was empty).
- Pivots: project path is too long for Windows build scripts, so work happens through a `subst T:` drive. pnpm 12 blocks build scripts by default; allowed prisma engines and swc, skipped esbuild's and @prisma/client's postinstall (both only verify/generate, and `prisma generate` runs explicitly in build).
- `.vercelignore` keeps `secrets/` and the local pnpm store out of uploads.

## 2026-11-09 Phase 2: Core logic
- `@tabby/core`: integer minor-unit money with remainder-safe `allocate`, all ISO 4217 currencies with pinned favourites, `computeSplit` with even/proportional/claims fee rules, `computeTripBalances` with saved FX rates, greedy `simplifyDebts`, `buildUpiUri`, zod schemas, and the platform parsers.
- 141 Jest tests (randomised balance checks, JPY, KWD, multi-currency, malformed VPAs, 26 invented order fixtures across 7 platforms plus receipts and emails). Switched ts-jest to @swc/jest (9 min to 4 s on this machine).

## 2026-11-09 Phase 3: Backend and guest pages
- API: bills (create/read/replace/delete, join, claims, participants), settlements (Unpaid, Marked paid, Confirmed with role checks), trips (create, join/take a seat, members, settle-up), FX via Frankfurter with cache, Google ID token exchange, /api/me settings, /api/demo, health. Auth.js wired for web sessions.
- Guest pages `/b/[slug]` and `/t/[slug]` poll every 3 s, show the fee breakdown, UPI deep link and QR. `/download` reads the latest GitHub Release. `/.well-known/assetlinks.json` serves the release SHA-256.
- Deployed to Vercel: https://tabby-split-amber.vercel.app. Seeded production with the Goa trip (4 settle-up payments, 1 confirmed, 1 marked) and the five standalone demo bills.
- Fixes found in testing: claim-to-host latency was 9 s because functions ran in iad1 against a Singapore database; pinned functions to sin1, now about 0.5 s. Hydration error from locale-dependent dates; pinned to en-IN/Asia/Kolkata.
- Open: Google web client still needs the redirect URI https://tabby-split-amber.vercel.app/api/auth/callback/google added by the owner (only needed for web sign-in; the app uses native sign-in).
