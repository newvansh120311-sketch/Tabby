import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { computeSplit, SOURCE_LABELS, type BillWrite } from '@tabby/core';
import { api, ApiError } from './api';
import { enqueue, newId, pendingBills, realSlug, useOutbox } from './outbox';
import { storage } from './storage';
import type { BillView, Me, TripView } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7,
      staleTime: 2000,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'always' },
  },
});

export const persister = createSyncStoragePersister({
  storage: {
    getItem: (k) => storage.getString(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.remove(k),
  },
  key: 'tabby.query-cache',
  throttleTime: 1000,
});

const POLL = 3000;

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ me: Me; googleConfigured: boolean }>('/api/me'),
  });
}

/** A bill made offline, shown from the queued payload until it reaches the server. */
function localBill(op: ReturnType<typeof pendingBills>[number]): BillView {
  const p = op.payload;
  const items = p.items.map((i, k) => ({ id: `l${k}`, name: i.name, amountMinor: i.amountMinor, qty: i.qty ?? 1, claimedBy: [] }));
  const charges = p.charges.map((c, k) => ({ id: `c${k}`, type: c.type, label: c.label ?? '', amountMinor: c.amountMinor }));
  const split = computeSplit({ currency: p.currency, splitMode: p.splitMode, items, charges, participants: [], claims: [] });
  return {
    id: op.localSlug,
    slug: op.localSlug,
    url: '',
    title: p.title,
    merchant: p.merchant ?? null,
    source: p.source,
    sourceLabel: SOURCE_LABELS[p.source],
    currency: p.currency,
    fxRateToBase: p.fxRateToBase ?? 1,
    splitMode: p.splitMode,
    feeRules: p.feeRules ?? {},
    date: p.date ?? new Date(op.createdAt).toISOString(),
    detectedTotalMinor: p.detectedTotalMinor ?? null,
    isDemo: false,
    version: 0,
    updatedAt: new Date(op.createdAt).toISOString(),
    trip: null,
    payerMemberId: p.payerMemberId ?? null,
    payee: { name: p.hostName ?? 'You', upiId: p.hostUpiId || null, participantId: null },
    isHost: true,
    meParticipantId: null,
    items,
    charges,
    participants: [],
    totals: {
      itemsMinor: split.itemsTotalMinor,
      chargesMinor: split.chargesTotalMinor,
      totalMinor: split.totalMinor,
      unclaimedMinor: split.totalMinor,
      unclaimedItemIds: items.map((i) => i.id),
    },
    pending: true,
  };
}

export function useBills() {
  const outbox = useOutbox();
  const q = useQuery({ queryKey: ['bills'], queryFn: () => api<{ bills: BillView[] }>('/api/bills') });
  const pending = pendingBills()
    .filter((o) => !o.payload.tripId)
    .map(localBill);
  return { ...q, bills: [...pending, ...(q.data?.bills ?? [])], outboxCount: outbox.count };
}

export function useTrips() {
  return useQuery({ queryKey: ['trips'], queryFn: () => api<{ trips: TripView[] }>('/api/trips') });
}

export function useBill(slug: string) {
  const s = realSlug(slug);
  const local = pendingBills().find((o) => o.localSlug === slug);
  const q = useQuery({
    queryKey: ['bill', s],
    queryFn: () => api<{ bill: BillView }>(`/api/bills/${s}`).then((r) => r.bill),
    refetchInterval: POLL,
    enabled: !local,
  });
  return { ...q, data: local ? localBill(local) : q.data };
}

export function useTrip(slug: string) {
  return useQuery({
    queryKey: ['trip', slug],
    queryFn: () => api<{ trip: TripView }>(`/api/trips/${slug}`).then((r) => r.trip),
    refetchInterval: POLL,
  });
}

/** Save a new bill. Offline, it's queued and shows up straight away as "waiting to sync". */
export async function createBill(payload: BillWrite): Promise<{ slug: string; queued: boolean }> {
  try {
    const { bill } = await api<{ bill: BillView }>('/api/bills', { method: 'POST', json: payload });
    queryClient.setQueryData(['bill', bill.slug], bill);
    void queryClient.invalidateQueries({ queryKey: ['bills'] });
    if (payload.tripId) void queryClient.invalidateQueries({ queryKey: ['trip'] });
    return { slug: bill.slug, queued: false };
  } catch (e) {
    if (!(e instanceof ApiError && e.offline)) throw e;
    const localSlug = `local${newId()}`;
    enqueue({ id: newId(), kind: 'createBill', localSlug, payload, createdAt: Date.now() });
    return { slug: localSlug, queued: true };
  }
}

export async function updateBill(slug: string, payload: BillWrite) {
  try {
    const { bill } = await api<{ bill: BillView }>(`/api/bills/${realSlug(slug)}`, { method: 'PUT', json: payload });
    queryClient.setQueryData(['bill', bill.slug], bill);
    void queryClient.invalidateQueries({ queryKey: ['trip'] });
  } catch (e) {
    if (!(e instanceof ApiError && e.offline)) throw e;
    enqueue({ id: newId(), kind: 'updateBill', slug, payload, createdAt: Date.now() });
  }
}

export function useClaim(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { participantId: string; itemId: string; claimed: boolean }) => {
      try {
        return (await api<{ bill: BillView }>(`/api/bills/${realSlug(slug)}/claims`, { method: 'POST', json: v })).bill;
      } catch (e) {
        if (e instanceof ApiError && e.offline) {
          enqueue({ id: newId(), kind: 'claim', slug, ...v, createdAt: Date.now() });
          return null;
        }
        throw e;
      }
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['bill', realSlug(slug)] });
      qc.setQueryData<BillView>(['bill', realSlug(slug)], (b) =>
        b
          ? {
              ...b,
              items: b.items.map((i) =>
                i.id === v.itemId
                  ? {
                      ...i,
                      claimedBy: v.claimed
                        ? [...new Set([...i.claimedBy, v.participantId])]
                        : i.claimedBy.filter((x) => x !== v.participantId),
                    }
                  : i,
              ),
            }
          : b,
      );
    },
    onSuccess: (bill) => bill && qc.setQueryData(['bill', bill.slug], bill),
  });
}

export function useSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { settlementId: string; status: 'marked' | 'confirmed' | 'unpaid' }) => {
      try {
        await api(`/api/settlements/${v.settlementId}`, { method: 'PATCH', json: { status: v.status } });
      } catch (e) {
        if (e instanceof ApiError && e.offline) enqueue({ id: newId(), kind: 'settlement', ...v, createdAt: Date.now() });
        else throw e;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['bill'] }),
  });
}

export function useTripPayment(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fromMemberId: string; toMemberId: string; status: 'marked' | 'confirmed' }) =>
      api<{ trip: TripView }>(`/api/trips/${slug}/settlements`, { method: 'POST', json: v }).then((r) => r.trip),
    onSuccess: (trip) => qc.setQueryData(['trip', slug], trip),
  });
}

export function useJoinBill(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; deviceToken: string; participantId?: string }) =>
      api<{ bill: BillView }>(`/api/bills/${realSlug(slug)}/join`, { method: 'POST', json: v }).then((r) => r.bill),
    onSuccess: (bill) => {
      qc.setQueryData(['bill', bill.slug], bill);
      void qc.invalidateQueries({ queryKey: ['bills'] });
    },
  });
}

export function useJoinTrip(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; deviceToken: string; memberId?: string; upiId?: string }) =>
      api<{ trip: TripView }>(`/api/trips/${slug}/join`, { method: 'POST', json: v }).then((r) => r.trip),
    onSuccess: (trip) => {
      qc.setQueryData(['trip', slug], trip);
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
