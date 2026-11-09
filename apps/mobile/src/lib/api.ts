import Constants from 'expo-constants';
import { authToken, deviceToken } from './storage';

export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'https://tabby-split-amber.vercel.app';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
  /** True when the request never reached the server (offline, DNS, timeout). */
  get offline() {
    return this.status === 0;
  }
}

export async function api<T>(path: string, init: { method?: string; json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-device-token': deviceToken(),
  };
  const tok = authToken.get();
  if (tok) headers.authorization = `Bearer ${tok}`;
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? 'GET',
      headers,
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'You seem to be offline. We’ll keep trying.');
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Something went wrong (${res.status}).`);
  return data as T;
}

/** Turn a tabby share link or a bare slug into a slug. */
export function slugFromLink(link: string): { kind: 'b' | 't'; slug: string } | null {
  const m = link.match(/\/(b|t)\/([a-z0-9]{4,12})(?:[/?#]|$)/i);
  return m ? { kind: m[1].toLowerCase() as 'b' | 't', slug: m[2].toLowerCase() } : null;
}
