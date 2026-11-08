# Tabby build log

## 2026-11-08 Phase 0: Pre-flight
- Android package `app.tabby.split`. AUTH_SECRET generated.
- Release keystore created with keytool (eas credentials needed the token first). SHA-1 18:84:AE:DE:…:68:E0, SHA-256 2F:D6:EE:E8:…:E9:16.
- Verified: EXPO_TOKEN (account vans_lords), GitHub PAT (test push to newvansh120311-sketch/Tabby), Vercel token, Neon DATABASE_URL (PG 18.6), Google web + Android client ID formats.
- Created EAS project @vans_lords/tabby (461a0fc8-…), Vercel project tabby-split. Secrets stored in EAS env (keystore as base64 secret) and Vercel env. EXPO_TOKEN stored as GitHub Actions secret.
- Pivots: gh CLI absent, used PAT over HTTPS with a per-command auth header (token never written to git config). Remote already had a README commit; local commit replayed on top.
- Fallbacks: no custom domain (vercel.app subdomain), no Play Console (APK via /download + GitHub Release).
- Open: Google web client redirect URI must be added by the owner after first deploy.
