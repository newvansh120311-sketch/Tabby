import { createMMKV } from 'react-native-mmkv';
import * as Crypto from 'expo-crypto';

export const storage = createMMKV({ id: 'tabby' });

export function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown) {
  storage.set(key, JSON.stringify(value));
}

/** A random token that identifies this install to the backend, made once. */
export function deviceToken(): string {
  let t = storage.getString('deviceToken');
  if (!t) {
    const bytes = Crypto.getRandomBytes(24);
    t = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    storage.set('deviceToken', t);
  }
  return t;
}

export const authToken = {
  get: () => storage.getString('authToken') ?? null,
  set: (t: string | null) => (t ? storage.set('authToken', t) : storage.remove('authToken')),
};

export const prefs = {
  onboarded: () => storage.getBoolean('onboarded') ?? false,
  setOnboarded: () => storage.set('onboarded', true),
};
