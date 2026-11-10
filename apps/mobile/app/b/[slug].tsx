import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CHARGE_LABELS, formatMoney, getCurrency } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { ShareLink } from '@/components/ShareSheet';
import { Badge, Button, Card, ErrorBox, Input, Row, Skeleton, StatusPill, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { draftStore, key, majorString } from '@/lib/draft';
import { queryClient, useBill, useClaim, useJoinBill, useMe, useSettlement } from '@/lib/queries';
import { deviceToken } from '@/lib/storage';
import { payWithUpi } from '@/lib/upi';

export default function BillScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const bill = useBill(slug);
  const me = useMe();
  const claim = useClaim(slug);
  const settle = useSettlement();
  const join = useJoinBill(slug);
  const [name, setName] = useState('');
  const [addName, setAddName] = useState('');

  useEffect(() => {
    if (!name && me.data?.me.displayName) setName(me.data.me.displayName);
  }, [me.data?.me.displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  const b = bill.data;
  if (!b) {
    return (
      <Screen>
        {bill.error ? <ErrorBox message={(bill.error as Error).message} onRetry={() => bill.refetch()} /> : <Skeleton rows={6} />}
      </Screen>
    );
  }

  const money = (m: number) => formatMoney(m, b.currency);
  const mine = b.participants.find((p) => p.id === b.meParticipantId);
  const host = b.participants.find((p) => p.isHost);
  const canClaim = !!mine && b.splitMode === 'items' && !b.pending;
  const names = new Map(b.participants.map((p) => [p.id, p.id === mine?.id ? 'You' : p.name]));
  const openSeats = b.participants.filter((p) => !p.isHost && p.id !== mine?.id && !b.isHost);

  function toggle(itemId: string) {
    if (!mine) return;
    const claimed = b!.items.find((i) => i.id === itemId)?.claimedBy.includes(mine.id) ?? false;
    void Haptics.selectionAsync();
    claim.mutate({ participantId: mine.id, itemId, claimed: !claimed }, { onError: (e) => Alert.alert('Couldn’t update', (e as Error).message) });
  }

  function edit() {
    const dec = getCurrency(b!.currency).decimals;
    const tip = b!.charges.find((c) => c.type === 'tip');
    draftStore.set({
      editingSlug: b!.slug,
      title: b!.title,
      merchant: b!.merchant ?? undefined,
      source: b!.source,
      currency: b!.currency,
      date: b!.date,
      items: b!.items.map((i) => ({ key: key(), id: i.id, name: i.name, amount: majorString(i.amountMinor, dec), qty: i.qty })),
      charges: b!.charges
        .filter((c) => c !== tip)
        .map((c) => ({ key: key(), type: c.type, label: c.label, amount: majorString(Math.abs(c.amountMinor), dec) })),
      feeRules: b!.feeRules ?? {},
      splitMode: b!.splitMode,
      tip: tip ? { mode: 'fixed', amount: majorString(tip.amountMinor, dec) } : { mode: 'none' },
      tax: { mode: 'none' },
      detectedTotalMinor: b!.detectedTotalMinor ?? undefined,
      warnings: [],
      tripSlug: b!.trip?.slug,
      payerMemberId: b!.payerMemberId ?? undefined,
      fxRate: b!.trip ? String(b!.fxRateToBase) : undefined,
    });
    router.push('/review');
  }

  async function addPerson() {
    const n = addName.trim();
    if (!n) return;
    try {
      const { bill: nb } = await api<{ bill: typeof b }>(`/api/bills/${b!.slug}/participants`, { method: 'POST', json: { add: [n] } });
      queryClient.setQueryData(['bill', b!.slug], nb);
      setAddName('');
    } catch (e) {
      Alert.alert('Couldn’t add them', (e as Error).message);
    }
  }

  function remove() {
    Alert.alert('Delete this bill?', 'Everyone with the link will lose it too. This can’t be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/bills/${b!.slug}`, { method: 'DELETE' });
            void queryClient.invalidateQueries({ queryKey: ['bills'] });
            if (b!.trip) void queryClient.invalidateQueries({ queryKey: ['trip', b!.trip.slug] });
            router.back();
          } catch (e) {
            Alert.alert('Couldn’t delete it', (e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: b.title,
          // Opened from a link there's nothing to go back to, so offer a way home instead.
          headerLeft: router.canGoBack() ? undefined : () => <Button variant="ghost" title="Home" onPress={() => router.replace('/')} />,
        }}
      />
      <Screen onRefresh={() => bill.refetch()} refreshing={bill.isRefetching}>
        <Row className="flex-wrap gap-2">
          <Badge tone="brand" label={b.sourceLabel} />
          {b.isDemo ? <Badge tone="warn" label="Demo data" /> : null}
          {b.pending ? <Badge tone="warn" label="Waiting to sync" /> : null}
          {b.trip ? <Badge label={`Trip: ${b.trip.name}`} /> : null}
        </Row>
        <View>
          <Text variant="title">{b.title}</Text>
          <Text variant="muted">
            {b.payee.name} paid {money(b.totals.totalMinor)} ·{' '}
            {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {b.isHost && !b.pending ? (
          <Card className="gap-3">
            <Text variant="h2">Send this to everyone</Text>
            <Text variant="muted">Friends open the link, tap what they had and see their share. They don’t need the app.</Text>
            <ShareLink url={b.url} title={b.title} message={`Tap what you had on “${b.title}” and Tabby works out your share:`} />
          </Card>
        ) : null}

        {!mine && !b.isHost && !b.pending ? (
          <Card className="gap-3">
            <Text variant="h2">Join to claim your items</Text>
            <Input testID="join-name" label="Your name" value={name} onChangeText={setName} placeholder="Your name" maxLength={60} />
            <Button title="Start claiming" loading={join.isPending} onPress={() => name.trim() && join.mutate({ name: name.trim(), deviceToken: deviceToken() })} />
            {openSeats.length ? (
              <>
                <Text variant="muted">Or pick your name if the host already added you:</Text>
                <Row className="flex-wrap gap-2">
                  {openSeats.map((p) => (
                    <Button key={p.id} variant="secondary" title={p.name} onPress={() => join.mutate({ name: p.name, deviceToken: deviceToken(), participantId: p.id })} />
                  ))}
                </Row>
              </>
            ) : null}
            {join.error ? <Text className="text-danger dark:text-danger-dark">{(join.error as Error).message}</Text> : null}
          </Card>
        ) : null}

        {canClaim ? <Text variant="muted">Tap everything you had. Shared something? Tap it too and the cost gets split.</Text> : null}
        {b.splitMode === 'even' ? <Text variant="muted">This bill is split evenly between everyone on it.</Text> : null}

        <Card className="p-0">
          {b.items.map((it, i) => {
            const isMine = !!mine && it.claimedBy.includes(mine.id);
            return (
              <Pressable
                key={it.id}
                disabled={!canClaim}
                onPress={() => toggle(it.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isMine, disabled: !canClaim }}
                accessibilityLabel={`${it.qty > 1 ? `${it.qty} ` : ''}${it.name}, ${money(it.amountMinor)}`}
                className={`min-h-14 flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line dark:border-line-dark' : ''} ${isMine ? 'bg-brandsoft dark:bg-brandsoft-dark' : ''}`}
              >
                {canClaim ? (
                  <View className={`h-6 w-6 items-center justify-center rounded-md border ${isMine ? 'border-brand bg-brand dark:border-brand-dark dark:bg-brand-dark' : 'border-line dark:border-line-dark'}`}>
                    {isMine ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                  </View>
                ) : null}
                <View className="flex-1">
                  <Text className="font-medium" numberOfLines={2}>
                    {it.qty > 1 ? `${it.qty} × ` : ''}
                    {it.name}
                  </Text>
                  <Text variant="small" numberOfLines={1}>
                    {it.claimedBy.length === 0 ? 'Nobody yet' : it.claimedBy.map((id) => names.get(id) ?? '?').join(', ')}
                    {it.claimedBy.length > 1 ? ` · ${money(Math.round(it.amountMinor / it.claimedBy.length))} each` : ''}
                  </Text>
                </View>
                <Text variant="money">{money(it.amountMinor)}</Text>
              </Pressable>
            );
          })}
          {b.charges.length ? (
            <View className="gap-1 border-t border-line px-4 py-3 dark:border-line-dark">
              {b.charges.map((c) => (
                <Row key={c.id} className="justify-between gap-3">
                  <Text variant="muted" className="flex-1" numberOfLines={1}>
                    {c.label || CHARGE_LABELS[c.type]}
                  </Text>
                  <Text variant="muted">{money(c.amountMinor)}</Text>
                </Row>
              ))}
            </View>
          ) : null}
          <Row className="justify-between border-t border-line px-4 py-3 dark:border-line-dark">
            <Text className="font-semibold">Total</Text>
            <Text variant="money">{money(b.totals.totalMinor)}</Text>
          </Row>
        </Card>

        {mine && !mine.isHost ? (
          <Card className="gap-3">
            <Row className="justify-between">
              <Text variant="h2">Your share</Text>
              <Text variant="money" className="text-2xl">
                {money(mine.totalMinor)}
              </Text>
            </Row>
            <Text variant="muted">
              {money(mine.itemsMinor)} for your items
              {mine.chargesMinor ? `, ${mine.chargesMinor > 0 ? 'plus' : 'minus'} ${money(Math.abs(mine.chargesMinor))} in fees, tax and discounts` : ''}.
            </Text>
            <StatusPill status={mine.status} />
            {b.trip ? (
              <Button variant="secondary" title="Settle up in the trip" onPress={() => router.push(`/t/${b.trip!.slug}`)} />
            ) : mine.totalMinor > 0 && mine.status === 'unpaid' ? (
              <View className="gap-2">
                {mine.upiUri ? (
                  <Button title={`Pay ${money(mine.totalMinor)} via UPI`} onPress={() => payWithUpi(mine.upiUri!)} />
                ) : (
                  <Text variant="muted">
                    {b.currency === 'INR' ? `${b.payee.name} hasn’t added a UPI ID, so pay them however you usually do.` : 'Pay the host however you usually do.'}
                  </Text>
                )}
                <Button
                  variant="secondary"
                  title="I’ve paid"
                  disabled={!mine.settlementId}
                  loading={settle.isPending}
                  onPress={() => mine.settlementId && settle.mutate({ settlementId: mine.settlementId, status: 'marked' })}
                />
              </View>
            ) : mine.status === 'marked' ? (
              <Text variant="muted">Thanks. {b.payee.name} will confirm when they see it.</Text>
            ) : null}
          </Card>
        ) : null}

        <Card className="gap-2">
          <Text variant="h2">{b.isHost ? 'Who owes you' : 'Everyone’s share'}</Text>
          {b.participants.map((p) => (
            <View key={p.id} className="gap-2 border-b border-line py-2 dark:border-line-dark">
              <Row className="justify-between gap-2">
                <Row className="flex-1 flex-wrap gap-2">
                  <Text>{p.id === mine?.id ? `${p.name} (you)` : p.name}</Text>
                  {p.isHost ? <Badge label="Paid" /> : null}
                  <StatusPill status={p.status} />
                </Row>
                <Text variant="money">{money(p.totalMinor)}</Text>
              </Row>
              {b.isHost && !b.trip && p.settlementId && p.status !== 'confirmed' ? (
                <Row className="gap-2">
                  <Button
                    className="flex-1"
                    variant={p.status === 'marked' ? 'primary' : 'secondary'}
                    title={p.status === 'marked' ? 'Confirm I got it' : 'Mark as received'}
                    onPress={() => settle.mutate({ settlementId: p.settlementId!, status: 'confirmed' })}
                  />
                </Row>
              ) : null}
            </View>
          ))}
          {b.totals.unclaimedMinor ? (
            <Row className="justify-between py-1">
              <Text className="text-warn dark:text-warn-dark">Not claimed yet</Text>
              <Text className="text-warn dark:text-warn-dark">{money(b.totals.unclaimedMinor)}</Text>
            </Row>
          ) : null}
          {b.isHost && b.totals.unclaimedItemIds.length ? (
            <Text variant="small">Waiting on: {b.items.filter((i) => b.totals.unclaimedItemIds.includes(i.id)).map((i) => i.name).join(', ')}</Text>
          ) : null}
          {b.isHost && !b.trip && !b.pending ? (
            <View className="mt-2 gap-2">
              <Input label="Add someone by name" value={addName} onChangeText={setAddName} placeholder="For friends without the link" onSubmitEditing={addPerson} />
              <Button variant="secondary" title="Add" onPress={addPerson} disabled={!addName.trim()} />
            </View>
          ) : null}
        </Card>

        {b.isHost && !b.pending ? (
          <Row className="gap-2">
            <Button className="flex-1" variant="secondary" title="Edit bill" onPress={edit} />
            <Button className="flex-1" variant="danger" title="Delete" onPress={remove} />
          </Row>
        ) : null}
        {host && !b.isHost && b.payee.upiId ? <Text variant="small">Payments go to {b.payee.upiId}{b.isDemo ? ' (a demo UPI ID)' : ''}.</Text> : null}
      </Screen>
    </>
  );
}
