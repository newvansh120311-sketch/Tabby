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

## 2026-11-09 Phase 4: Android app, scanning and bills
- Expo SDK 58 (RN 0.88, new architecture), Expo Router, NativeWind 4 with components written in the React Native Reusables style (Button, Card, Input, Badge, Chip), TanStack Query persisted to MMKV.
- OCR: a local Expo module in Kotlin (`modules/tabby-native`) wrapping bundled ML Kit text recognition. Pivot from `@react-native-ml-kit/text-recognition`, which predates the new architecture that RN 0.88 requires. The module returns lines with boxes; `linesToText` in core rebuilds receipt rows and corrects photo tilt (searches -10° to +10°), covered by Jest.
- Screens: home, new bill (scan, photo, paste, type in), camera scan, paste import, review (currency picker, items, charges with per-type fee rules, tip as % or amount, split mode, mismatch warning), bill (claiming, host summary, share sheet / copy / QR, live polling, edit, delete, add people).
- Sample images (invented): clean, skewed and faded receipts plus Swiggy, Zomato and Instamart order screens in `apps/mobile/assets/samples`.

## 2026-11-09 Phase 5: Auth, settings and UPI
- Native Google sign-in (`@react-native-google-signin/google-signin`) exchanging the ID token at `/api/mobile/google` for an app session token; device-token mode works without it and the button reads "Sign-in not configured" when no client ID is baked in.
- Settings: display name, default currency (searchable ISO 4217 list, pinned favourites), UPI ID validated. Defaults flow into new bills and trip seats.
- UPI: `upi://pay` via Linking with a no-UPI-app check through the native module and package-visibility `<queries>`. Paid flow Unpaid → Marked paid → Confirmed with role checks on the server.

## 2026-11-09 Phase 6: Trip mode
- Create trip with base currency and named seats, invite by link or QR, join by taking a seat (App Links on /t/). Add bills with payer picker, split mode and auto-fetched FX rate (editable, saved per bill). Settle-up, balances and timeline tabs; each payment has its own UPI button; owner marks the trip settled once nothing is owed.

## 2026-11-09 Phase 7: Delivery and booking app import
- Share target for text/* and image/* via expo-share-intent; share-received screen shows progress and offers open trips. Platform detection uses the sender package (activity referrer, best effort) and keywords, with Instamart text winning over the shared Swiggy package.
- Parsers for Swiggy, Zomato, Instamart, Zepto, Blinkit, District, EazyDiner plus receipt and email fallbacks, 26 invented fixtures (3+ per platform). Paste or share email text. "Order together" shortcuts only list apps that are installed. Source badges are plain text; no platform logos anywhere.
- CI workflow (Jest, typechecks, Playwright against production), tag-triggered release workflow (EAS build with Gradle fallback, GitHub Release), OTA workflow.
- Pivot: first EAS build failed before dependency install. pnpm 12's lockfile format isn't readable there, so the repo moved to pnpm 10.34 (settings in pnpm-workspace.yaml, hoisted node_modules, one React version across web and mobile).

## 2026-11-09 Phase 8: Polish, ship and verify
- Onboarding (three screens plus "Try a demo trip" that clones the Goa trip for the device), empty states, skeletons, friendly errors, light/dark themes, app icon, adaptive icon and splash rendered from SVG. Offline outbox for new bills, edits, claims, payment status and settings, with a sync banner.
- Cloud builds: first two EAS builds failed before installing dependencies with no message. Causes found: pnpm 12 lockfile (moved to pnpm 10) and running eas-cli from a `subst` drive, which gave EAS a broken project path (now run from the real path). Third build succeeded.
- Release: tag `v1.0.0` ran the Release APK workflow on GitHub Actions, built on EAS with the release keystore and published https://github.com/newvansh120311-sketch/Tabby/releases/tag/v1.0.0 (101 MB after dropping the 32-bit x86 ABI). /download serves it with an install QR code. Verified: APK signed with SHA-256 2F:D6:EE…E9:16, versionCode 6, embedded config points at production, EAS Update channel `production`.
- Verified on a Pixel 7 emulator (Android 14) with the first cloud APK: launch, onboarding and demo trip (Maestro), sharing Swiggy order text (Maestro, 6 items, fees, coupon and partner tip, total matches), App Links verified for tabby-split-amber.vercel.app and opening /b/ links in the app, settings validation.
- Found on device and fixed in v1.0.0: shared images landed on a blank screen (added `+native-intent` redirect for expo-share-intent links), clipped onboarding emoji, no way home from a deep-linked bill.
- Not re-verified on device: the v1.0.0 APK installs and starts, but the emulator kept hitting system "not responding" errors and then failed to boot because this 8 GB machine ran out of memory. Image sharing via OCR, the manual bill and guest UPI Maestro flows, 360dp and tablet layouts, in-app dark mode and offline sync on device are covered by code and web tests but were not observed on the final APK.
- Web: Playwright 15/15 at 375, 768 and 1440 px (dark mode at 1440) against production with no console errors after replacing locale date formatting. CI green.
