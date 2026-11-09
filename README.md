# Tabby

Split restaurant bills, delivery orders and whole trips with friends, then settle up over UPI.

- **Web app and guest pages:** https://tabby-split-amber.vercel.app
- **Android app:** https://tabby-split-amber.vercel.app/download (latest APK, with an install QR code)
- **Demo trip:** https://tabby-split-amber.vercel.app/t/goa26

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| `packages/core` | shared TypeScript | Money in integer minor units, the split engine and fee rules, trip balances, debt simplification, UPI links, zod schemas, OCR row rebuilding, and one parser per delivery or booking app |
| `apps/web` | Next.js 15 on Vercel | REST API for the app, guest claim page `/b/[slug]`, trip page `/t/[slug]`, `/download`, `/.well-known/assetlinks.json` |
| `apps/mobile` | Expo SDK 58 dev build | The Android app: scanning with on-device ML Kit, share target, review and claiming, trips, UPI |
| Database | Neon Postgres via Prisma | Bills, items, charges, claims, trips, members, settlements, Auth.js tables |

## Using it

**Install on Android.** Open the download page on your phone, download the APK, open it, and when Android asks, allow your browser to install apps. Android 10 or newer.

**Split a Swiggy or Zomato order.** In the delivery app, open the order and screenshot the bill details (or copy the order text). Tap Share, pick Tabby, and choose a trip if it belongs to one. Check the bill, save, and send the link.

**Ship a new APK.** Push a tag:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

The `Release APK` workflow builds a signed APK on EAS (falling back to a Gradle build on the runner), attaches it to a GitHub Release, and the download page picks it up within five minutes.

**Push a quick fix without a new APK.** Run the `OTA update` workflow from the Actions tab with a short message, or locally:

```bash
cd apps/mobile && npx eas-cli update --channel production --environment production --message "Fix the tip rounding"
```

Installed apps download the update the next time they open. Anything that changes native code (new libraries, permissions, the Kotlin module) needs a new APK instead.

## Local setup (development and testing only)

Production runs entirely on Vercel, Neon and EAS. You only need this to work on the code.

1. Node 22+ and pnpm 12. On Windows, keep the checkout at a short path (or `subst` a drive letter) because React Native build scripts break past 260 characters.
2. `pnpm install`
3. Copy `.env.example` to `apps/web/.env` and fill it in. Use a separate Neon branch for development rather than the production database.
4. Web: `cd apps/web && npx prisma generate && npx prisma migrate deploy && npx tsx prisma/seed.ts && pnpm dev`
5. Mobile: `cd apps/mobile && EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo run:android` builds a dev client onto a running emulator. Without that variable the app talks to production.
6. Tests: `pnpm --filter @tabby/core test` (Jest), `cd apps/web && BASE_URL=http://localhost:3000 npx playwright test`, and `maestro test apps/mobile/.maestro` with the app installed on an emulator.

Secrets never go in the repo. They live in Vercel project settings, EAS environment variables and GitHub Actions secrets. The release keystore is only in EAS and GitHub secrets, plus the owner's local `secrets/` folder, which is gitignored.
