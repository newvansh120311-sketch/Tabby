// Lets Android verify that tabby links open in the app (App Links).
export const dynamic = 'force-static';

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: process.env.ANDROID_PACKAGE ?? 'app.tabby.split',
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
