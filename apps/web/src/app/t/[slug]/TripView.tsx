'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@tabby/core';
import type { TripView as Trip } from '@/lib/trips';
import { api, deviceToken, savedName, saveName } from '@/lib/client';
import { Badge, Button, Card, Qr, StatusPill } from '@/components/ui';

export default function TripView({ initial }: { initial: Trip }) {
  const [trip, setTrip] = useState(initial);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const money = (m: number, c = trip.baseCurrency) => formatMoney(m, c);

  const refresh = useCallback(async () => {
    try {
      const { trip: t } = await api<{ trip: Trip }>(`/api/trips/${initial.slug}`);
      setTrip(t);
    } catch {
      /* keep last copy */
    }
  }, [initial.slug]);

  useEffect(() => {
    setName(savedName());
    refresh();
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function join(memberId?: string, seatName?: string) {
    const n = (seatName ?? name).trim();
    if (!n) return setError('Add your name first.');
    setBusy(true);
    setError(null);
    try {
      saveName(n);
      const { trip: t } = await api<{ trip: Trip }>(`/api/trips/${trip.slug}/join`, {
        method: 'POST',
        json: { name: n, deviceToken: deviceToken(), memberId },
      });
      setTrip(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function record(fromMemberId: string, toMemberId: string, status: 'marked' | 'confirmed') {
    setBusy(true);
    setError(null);
    try {
      const { trip: t } = await api<{ trip: Trip }>(`/api/trips/${trip.slug}/settlements`, {
        method: 'POST',
        json: { fromMemberId, toMemberId, status },
      });
      setTrip(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const me = trip.meMemberId;
  const openSeats = trip.members.filter((m) => !m.joined);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge tone="brand">Trip</Badge>
          {trip.isDemo && <Badge tone="warn">Demo data</Badge>}
          {trip.settledAt && <Badge tone="ok">Settled</Badge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{trip.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {trip.members.length} people, {trip.bills.length} bills, everything shown in {trip.baseCurrency}.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-surface p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!me && (
        <Card>
          <h2 className="font-semibold">Join this trip</h2>
          <p className="mt-1 text-sm text-muted">Pick your name, or add yourself if you’re not on the list.</p>
          {openSeats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {openSeats.map((m) => (
                <Button key={m.id} variant="secondary" disabled={busy} onClick={() => join(m.id, m.name)}>
                  I’m {m.name}
                </Button>
              ))}
            </div>
          )}
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <label className="sr-only" htmlFor="trip-name">
              Your name
            </label>
            <input
              id="trip-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-base outline-none focus:border-brand"
            />
            <Button type="submit" variant="secondary" disabled={busy}>
              Add me
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Settle up</h2>
        {trip.payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Everyone is even. Nothing left to pay.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              The fewest payments that make everyone even. Confirmed payments drop off this list.
            </p>
            <ul className="mt-3 space-y-3">
              {trip.payments.map((p) => {
                const key = `${p.fromMemberId}-${p.toMemberId}`;
                const iOwe = me === p.fromMemberId;
                const iReceive = me === p.toMemberId || trip.isOwner;
                return (
                  <li key={key} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>{p.fromName}</strong> pays <strong>{p.toName}</strong>
                      </span>
                      <span className="money text-lg font-semibold">{money(p.amountMinor)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={p.status} />
                      {iOwe && p.upiUri && p.status === 'unpaid' && (
                        <a
                          href={p.upiUri}
                          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink"
                        >
                          Pay {money(p.amountMinor)} via UPI
                        </a>
                      )}
                      {iOwe && p.upiUri && p.status === 'unpaid' && (
                        <Button variant="ghost" onClick={() => setQrFor(qrFor === key ? null : key)}>
                          {qrFor === key ? 'Hide QR' : 'Show QR'}
                        </Button>
                      )}
                      {iOwe && p.status === 'unpaid' && (
                        <Button variant="secondary" disabled={busy} onClick={() => record(p.fromMemberId, p.toMemberId, 'marked')}>
                          I’ve paid
                        </Button>
                      )}
                      {iReceive && !iOwe && p.status !== 'confirmed' && (
                        <Button variant="secondary" disabled={busy} onClick={() => record(p.fromMemberId, p.toMemberId, 'confirmed')}>
                          Confirm I got it
                        </Button>
                      )}
                    </div>
                    {qrFor === key && p.upiUri && (
                      <div className="mt-3">
                        <Qr value={p.upiUri} label={`UPI QR code to pay ${p.toName}`} />
                      </div>
                    )}
                    {iOwe && !p.upiUri && trip.baseCurrency === 'INR' && (
                      <p className="mt-2 text-xs text-muted">{p.toName} hasn’t added a UPI ID to this trip yet.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {trip.confirmedPayments.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Already paid ({trip.confirmedPayments.length})</summary>
            <ul className="mt-2 space-y-1">
              {trip.confirmedPayments.map((c) => (
                <li key={c.id} className="flex justify-between text-muted">
                  <span>
                    {c.fromName} paid {c.toName}
                  </span>
                  <span className="money">{money(c.amountMinor)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Balances</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-normal">Who</th>
                <th className="py-1 text-right font-normal">Paid</th>
                <th className="py-1 text-right font-normal">Share</th>
                <th className="py-1 text-right font-normal">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trip.balances.map((b) => (
                <tr key={b.memberId}>
                  <td className="py-2">{b.memberId === me ? `${b.name} (you)` : b.name}</td>
                  <td className="money py-2 text-right">{money(b.paidMinor)}</td>
                  <td className="money py-2 text-right">{money(b.owedMinor)}</td>
                  <td className={`money py-2 text-right font-medium ${b.netMinor > 0 ? 'text-ok' : b.netMinor < 0 ? 'text-danger' : ''}`}>
                    {money(b.netMinor, trip.baseCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Net is what others owe that person, after confirmed payments.</p>
      </Card>

      <Card>
        <h2 className="font-semibold">Timeline</h2>
        {trip.bills.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No bills yet. Add one from the Tabby app.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {trip.bills.map((b) => (
              <li key={b.slug}>
                <a href={`/b/${b.slug}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {new Date(b.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                      {b.payerName} paid · {b.sourceLabel}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="money block font-medium">{money(b.totalBaseMinor)}</span>
                    {b.currency !== trip.baseCurrency && (
                      <span className="money block text-xs text-muted">{formatMoney(b.totalMinor, b.currency)}</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
