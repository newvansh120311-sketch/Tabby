'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHARGE_LABELS, ChargeType, formatMoney } from '@tabby/core';
import type { BillView } from '@/lib/bills';
import { api, deviceToken, savedName, saveName } from '@/lib/client';
import { Badge, Button, Card, Qr, StatusPill } from '@/components/ui';

const POLL_MS = 3000;

export default function BillClaim({ initial }: { initial: BillView }) {
  const [bill, setBill] = useState(initial);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const money = useCallback((m: number) => formatMoney(m, bill.currency), [bill.currency]);

  const refresh = useCallback(async () => {
    try {
      const { bill: b } = await api<{ bill: BillView }>(`/api/bills/${initial.slug}`);
      setBill(b);
    } catch {
      /* keep the last good copy while offline */
    }
  }, [initial.slug]);

  useEffect(() => {
    setName(savedName());
    refresh();
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const me = bill.participants.find((p) => p.id === bill.meParticipantId) ?? null;
  const openSeats = bill.participants.filter((p) => !p.isHost && p.id !== me?.id);

  async function join(seatId?: string, seatName?: string) {
    const n = (seatName ?? name).trim();
    if (!n) return setError('Add your name so the host knows who you are.');
    setBusy(true);
    setError(null);
    try {
      saveName(n);
      const { bill: b } = await api<{ bill: BillView }>(`/api/bills/${bill.slug}/join`, {
        method: 'POST',
        json: { name: n, deviceToken: deviceToken(), participantId: seatId },
      });
      setBill(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(itemId: string) {
    if (!me) return;
    const claimed = bill.items.find((i) => i.id === itemId)?.claimedBy.includes(me.id) ?? false;
    // Optimistic: flip it now, the next poll corrects anything that went wrong.
    setBill((b) => ({
      ...b,
      items: b.items.map((i) =>
        i.id === itemId
          ? { ...i, claimedBy: claimed ? i.claimedBy.filter((x) => x !== me.id) : [...i.claimedBy, me.id] }
          : i,
      ),
    }));
    try {
      const { bill: b } = await api<{ bill: BillView }>(`/api/bills/${bill.slug}/claims`, {
        method: 'POST',
        json: { participantId: me.id, itemId, claimed: !claimed },
      });
      setBill(b);
    } catch (e) {
      setError((e as Error).message);
      refresh();
    }
  }

  async function markPaid() {
    if (!me?.settlementId) return;
    setBusy(true);
    try {
      await api(`/api/settlements/${me.settlementId}`, { method: 'PATCH', json: { status: 'marked' } });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const nameOf = useMemo(() => new Map(bill.participants.map((p) => [p.id, p.name])), [bill.participants]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="brand">{bill.sourceLabel}</Badge>
          {bill.isDemo && <Badge tone="warn">Demo data</Badge>}
          {bill.trip && <Badge>Part of {bill.trip.name}</Badge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{bill.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {bill.payee.name} paid {money(bill.totals.totalMinor)}
          {bill.merchant && bill.merchant !== bill.title ? ` at ${bill.merchant}` : ''} on{' '}
          {new Date(bill.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-surface p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!me && (
        <Card>
          <h2 className="font-semibold">Who are you?</h2>
          <p className="mt-1 text-sm text-muted">No account needed. Your name just tells the host whose share is whose.</p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <label className="sr-only" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              autoComplete="given-name"
              className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-base outline-none focus:border-brand"
            />
            <Button type="submit" disabled={busy}>
              {busy ? 'Joining…' : 'Start claiming'}
            </Button>
          </form>
          {openSeats.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted">Or pick your name if the host already added you:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {openSeats.map((p) => (
                  <Button key={p.id} variant="secondary" disabled={busy} onClick={() => join(p.id, p.name)}>
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {me && bill.splitMode === 'items' && (
        <p className="text-sm text-muted">
          Hi {me.name}. Tap everything you had. If you shared something, tap it too and the cost gets divided.
        </p>
      )}
      {bill.splitMode === 'even' && <p className="text-sm text-muted">This bill is split evenly between everyone on it.</p>}

      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {bill.items.map((item) => {
            const mine = !!me && item.claimedBy.includes(me.id);
            const others = item.claimedBy.filter((id) => id !== me?.id).map((id) => nameOf.get(id) ?? '?');
            const interactive = !!me && bill.splitMode === 'items';
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => toggle(item.id)}
                  aria-pressed={mine}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${interactive ? 'hover:bg-surface-2' : ''} ${mine ? 'bg-brand-soft' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs ${mine ? 'border-brand bg-brand text-brand-ink' : 'border-line'}`}
                  >
                    {mine ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.qty > 1 ? `${item.qty} × ` : ''}
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {item.claimedBy.length === 0
                        ? 'Nobody yet'
                        : [mine ? 'You' : null, ...others].filter(Boolean).join(', ')}
                      {item.claimedBy.length > 1 ? ` · ${money(Math.round(item.amountMinor / item.claimedBy.length))} each` : ''}
                    </span>
                  </span>
                  <span className="money shrink-0 font-medium">{money(item.amountMinor)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {bill.charges.length > 0 && (
          <ul className="space-y-1 border-t border-line px-4 py-3 text-sm">
            {bill.charges.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 text-muted">
                <span className="truncate">{c.label || CHARGE_LABELS[c.type as ChargeType]}</span>
                <span className="money">{money(c.amountMinor)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between border-t border-line px-4 py-3 font-semibold">
          <span>Total</span>
          <span className="money">{money(bill.totals.totalMinor)}</span>
        </div>
      </Card>

      {me && !me.isHost && (
        <Card className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Your share</h2>
            <span className="money text-2xl font-semibold">{money(me.totalMinor)}</span>
          </div>
          <p className="text-sm text-muted">
            {money(me.itemsMinor)} for your items
            {me.chargesMinor !== 0 ? `, ${me.chargesMinor > 0 ? 'plus' : 'minus'} ${money(Math.abs(me.chargesMinor))} in fees, tax and discounts` : ''}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={me.status} />
          </div>
          {bill.trip ? (
            <p className="text-sm text-muted">
              This bill is part of a trip, so you settle up once for the whole trip.{' '}
              <a className="underline" href={`/t/${bill.trip.slug}`}>
                Open the trip
              </a>
            </p>
          ) : me.totalMinor > 0 && me.status !== 'confirmed' ? (
            <div className="space-y-3">
              {me.upiUri ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <a
                      href={me.upiUri}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink hover:opacity-90"
                    >
                      Pay {money(me.totalMinor)} via UPI
                    </a>
                    <Button variant="secondary" onClick={() => setShowQr((s) => !s)}>
                      {showQr ? 'Hide QR code' : 'Pay from another phone'}
                    </Button>
                  </div>
                  {showQr && (
                    <div className="flex flex-col items-start gap-2">
                      <Qr value={me.upiUri} label={`UPI QR code to pay ${bill.payee.name}`} />
                      <p className="text-xs text-muted">Scan with any UPI app. It pays {bill.payee.upiId} directly.</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">
                  {bill.currency === 'INR'
                    ? `${bill.payee.name} hasn’t added a UPI ID yet, so pay them however you usually do.`
                    : 'Pay the host however you usually do, then let them know here.'}
                </p>
              )}
              {me.status === 'unpaid' && (
                <Button variant="secondary" onClick={markPaid} disabled={busy || !me.settlementId}>
                  I’ve paid
                </Button>
              )}
              {me.status === 'marked' && (
                <p className="text-sm text-muted">Thanks. {bill.payee.name} will confirm once they see the money.</p>
              )}
            </div>
          ) : null}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Everyone’s share</h2>
        <ul className="mt-2 divide-y divide-line">
          {bill.participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{p.id === me?.id ? `${p.name} (you)` : p.name}</span>
                {p.isHost && <Badge>Paid the bill</Badge>}
                <StatusPill status={p.status} />
              </span>
              <span className="money shrink-0">{money(p.totalMinor)}</span>
            </li>
          ))}
          {bill.totals.unclaimedMinor !== 0 && (
            <li className="flex items-center justify-between gap-3 py-2 text-warn">
              <span>Not claimed yet</span>
              <span className="money">{money(bill.totals.unclaimedMinor)}</span>
            </li>
          )}
        </ul>
      </Card>

      <p className="text-center text-xs text-muted">
        Updates every few seconds. Have Android?{' '}
        <a className="underline" href="/download">
          Get Tabby
        </a>{' '}
        to scan your own bills.
      </p>
    </div>
  );
}
