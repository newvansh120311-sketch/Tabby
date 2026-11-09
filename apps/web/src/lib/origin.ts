/** Public base URL for share links. Falls back to the request's own origin. */
export function originOf(req?: Request): string {
  const env = process.env.PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  if (req) {
    const u = new URL(req.url);
    const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
    const host = req.headers.get('x-forwarded-host') ?? u.host;
    return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}
