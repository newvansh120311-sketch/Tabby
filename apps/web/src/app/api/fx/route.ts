import { isCurrency } from '@tabby/core';
import { HttpError, json, route } from '@/lib/http';

const cache = new Map<string, { rate: number; date: string; at: number }>();
const TTL = 6 * 60 * 60 * 1000;

/** 1 unit of `from` in `to`, via Frankfurter (ECB rates, no key). */
export const GET = route(async (req) => {
  const u = new URL(req.url);
  const from = (u.searchParams.get('from') ?? '').toUpperCase();
  const to = (u.searchParams.get('to') ?? '').toUpperCase();
  if (!isCurrency(from) || !isCurrency(to)) throw new HttpError(422, 'Unknown currency.');
  if (from === to) return json({ from, to, rate: 1, date: new Date().toISOString().slice(0, 10), source: 'identity' });
  const key = `${from}-${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return json({ from, to, rate: hit.rate, date: hit.date, source: 'frankfurter' });
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { next: { revalidate: 21600 } });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { date: string; rates: Record<string, number> };
    const rate = data.rates[to];
    if (!rate) throw new Error('missing rate');
    cache.set(key, { rate, date: data.date, at: Date.now() });
    return json({ from, to, rate, date: data.date, source: 'frankfurter' });
  } catch {
    return json({ from, to, rate: null, error: 'No live rate for this pair. Type the rate in by hand.' }, 200);
  }
});
