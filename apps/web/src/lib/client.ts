'use client';

const KEY = 'tabby.deviceToken';
const NAME_KEY = 'tabby.name';

function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function deviceToken(): string {
  try {
    let t = localStorage.getItem(KEY);
    if (!t) {
      t = randomToken();
      localStorage.setItem(KEY, t);
    }
    return t;
  } catch {
    // Private mode without storage: keep one token for this page load.
    const w = window as unknown as { __tabbyToken?: string };
    return (w.__tabbyToken ??= randomToken());
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      'x-device-token': deviceToken(),
      ...(rest.headers ?? {}),
    },
    body: json === undefined ? rest.body : JSON.stringify(json),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
