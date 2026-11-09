import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';
import type { BillWrite } from '@tabby/core';
import { api, ApiError } from './api';
import { getJSON, setJSON } from './storage';
import type { BillView } from './types';

// Changes made offline wait here and are sent in order once the phone is back online.
export type Op =
  | { id: string; kind: 'createBill'; localSlug: string; payload: BillWrite; createdAt: number }
  | { id: string; kind: 'updateBill'; slug: string; payload: BillWrite; createdAt: number }
  | { id: string; kind: 'claim'; slug: string; participantId: string; itemId: string; claimed: boolean; createdAt: number }
  | { id: string; kind: 'settlement'; settlementId: string; status: 'marked' | 'confirmed' | 'unpaid'; createdAt: number }
  | { id: string; kind: 'settings'; payload: { displayName: string; defaultCurrency: string; upiId: string | null }; createdAt: number };

const KEY = 'outbox';
let ops: Op[] = getJSON<Op[]>(KEY, []);
let syncing = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let snapshot: { count: number; syncing: boolean; lastError: string | null } = { count: ops.length, syncing, lastError };

function emit() {
  snapshot = { count: ops.length, syncing, lastError };
  setJSON(KEY, ops);
  listeners.forEach((l) => l());
}

/** Local slug -> real slug for bills created offline, so screens can follow the bill. */
const renamed = getJSON<Record<string, string>>('outbox.renamed', {});
export const realSlug = (slug: string) => renamed[slug] ?? slug;

export function enqueue(op: Op) {
  ops = [...ops, op];
  emit();
  void flush();
}

export function pendingBills(): Extract<Op, { kind: 'createBill' }>[] {
  return ops.filter((o): o is Extract<Op, { kind: 'createBill' }> => o.kind === 'createBill');
}

export async function flush(onSynced?: () => void) {
  if (syncing || ops.length === 0) return;
  syncing = true;
  lastError = null;
  emit();
  try {
    while (ops.length) {
      const op = ops[0];
      try {
        await run(op);
      } catch (e) {
        if (e instanceof ApiError && e.offline) break; // try again when back online
        // The server said no (for example the bill was deleted). Drop it so the queue moves.
        lastError = e instanceof Error ? e.message : String(e);
      }
      ops = ops.slice(1);
      emit();
    }
  } finally {
    syncing = false;
    emit();
    onSynced?.();
  }
}

async function run(op: Op) {
  switch (op.kind) {
    case 'createBill': {
      const { bill } = await api<{ bill: BillView }>('/api/bills', { method: 'POST', json: op.payload });
      renamed[op.localSlug] = bill.slug;
      setJSON('outbox.renamed', renamed);
      // Later queued ops may point at the local slug.
      ops = ops.map((o) => ('slug' in o && o.slug === op.localSlug ? { ...o, slug: bill.slug } : o));
      return;
    }
    case 'updateBill':
      await api(`/api/bills/${realSlug(op.slug)}`, { method: 'PUT', json: op.payload });
      return;
    case 'claim':
      await api(`/api/bills/${realSlug(op.slug)}/claims`, {
        method: 'POST',
        json: { participantId: op.participantId, itemId: op.itemId, claimed: op.claimed },
      });
      return;
    case 'settlement':
      await api(`/api/settlements/${op.settlementId}`, { method: 'PATCH', json: { status: op.status } });
      return;
    case 'settings':
      await api('/api/me', { method: 'PUT', json: op.payload });
      return;
  }
}

export function startOutbox(onSynced: () => void) {
  return NetInfo.addEventListener((s) => {
    if (s.isConnected && s.isInternetReachable !== false) void flush(onSynced);
  });
}

export function useOutbox() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
