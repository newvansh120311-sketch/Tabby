import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { formatMoney } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { ShareLink } from '@/components/ShareSheet';
import { Badge, Button, Card, Chip, ErrorBox, Input, Row, Skeleton, StatusPill, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { queryClient, useJoinTrip, useMe, useTrip, useTripPayment } from '@/lib/queries';
import { deviceToken } from '@/lib/storage';
import type { TripView } from '@/lib/types';
import { payWithUpi } from '@/lib/upi';

type Tab = 'settle' | 'balances' | 'timeline';

export default function TripScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const trip = useTrip(slug);
  const me = useMe();
  const join = useJoinTrip(slug);
  const pay = useTripPayment(slug);
  const [tab, setTab] = useState<Tab>('settle');
  const [name, setName] = useState('');
  const [newMember, setNewMember] = useState('');

  useEffect(() => {
    if (!name && me.data?.me.displayName) setName(me.data.me.displayName);
  }, [me.data?.me.displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = trip.data;
  if (!t) {
    return <Screen>{trip.error ? <ErrorBox message={(trip.error as Error).message} onRetry={() => trip.refetch()} /> : <Skeleton rows={6} />}</Screen>;
  }
  const money = (m: number, c = t.baseCurrency) => formatMoney(m, c);
  const meId = t.meMemberId;
  const openSeats = t.members.filter((m) => !m.joined);

  async function addMember() {
    const n = newMember.trim();
    if (!n) return;
    try {
      const { trip: nt } = await api<{ trip: TripView }>(`/api/trips/${slug}/members`, { method: 'POST', json: { add: [n] } });
      queryClient.setQueryData(['trip', slug], nt);
      setNewMember('');
    } catch (e) {
      Alert.alert('Couldn’t add them', (e as Error).message);
    }
  }

  async function markSettled() {
    try {
      const { trip: nt } = await api<{ trip: TripView }>(`/api/trips/${slug}`, { method: 'PATCH', json: { settled: true } });
      queryClient.setQueryData(['trip', slug], nt);
    } catch (e) {
      Alert.alert('Not yet', (e as Error).message);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t.name }} />
      <Screen
        onRefresh={() => trip.refetch()}
        refreshing={trip.isRefetching}
        footer={meId && !t.settledAt ? <Button title="Add a bill" icon="＋" onPress={() => router.push({ pathname: '/new', params: { trip: slug } })} /> : undefined}
      >
        <Row className="flex-wrap gap-2">
          <Badge tone="brand" label="Trip" />
          {t.isDemo ? <Badge tone="warn" label="Demo data" /> : null}
          {t.settledAt ? <Badge tone="ok" label="Settled" /> : null}
        </Row>
        <View>
          <Text variant="title">{t.name}</Text>
          <Text variant="muted">
            {t.members.map((m) => m.name).join(', ')} · in {t.baseCurrency}
          </Text>
        </View>

        {!meId ? (
          <Card className="gap-3">
            <Text variant="h2">Join this trip</Text>
            {openSeats.length ? (
              <Row className="flex-wrap gap-2">
                {openSeats.map((m) => (
                  <Button key={m.id} variant="secondary" title={`I’m ${m.name}`} onPress={() => join.mutate({ name: m.name, memberId: m.id, deviceToken: deviceToken(), upiId: me.data?.me.upiId ?? '' })} />
                ))}
              </Row>
            ) : null}
            <Input label="Or add yourself" value={name} onChangeText={setName} placeholder="Your name" />
            <Button title="Join" loading={join.isPending} onPress={() => name.trim() && join.mutate({ name: name.trim(), deviceToken: deviceToken(), upiId: me.data?.me.upiId ?? '' })} />
            {join.error ? <Text className="text-danger dark:text-danger-dark">{(join.error as Error).message}</Text> : null}
          </Card>
        ) : null}

        <Row className="gap-2">
          <Chip label="Settle up" selected={tab === 'settle'} onPress={() => setTab('settle')} />
          <Chip label="Balances" selected={tab === 'balances'} onPress={() => setTab('balances')} />
          <Chip label={`Timeline (${t.bills.length})`} selected={tab === 'timeline'} onPress={() => setTab('timeline')} />
        </Row>

        {tab === 'settle' ? (
          <Card className="gap-3">
            {t.payments.length === 0 ? (
              <>
                <Text variant="h2">Everyone’s even</Text>
                <Text variant="muted">{t.bills.length ? 'Nothing left to pay on this trip.' : 'Add the first bill and balances show up here.'}</Text>
                {t.isOwner && !t.settledAt && t.bills.length ? <Button title="Mark the trip as settled" onPress={markSettled} /> : null}
              </>
            ) : (
              <>
                <Text variant="muted">
                  {t.payments.length} payment{t.payments.length === 1 ? '' : 's'} square{t.payments.length === 1 ? 's' : ''} everyone up.
                </Text>
                {t.payments.map((p) => {
                  const iOwe = meId === p.fromMemberId;
                  const iGet = meId === p.toMemberId || t.isOwner;
                  return (
                    <View key={`${p.fromMemberId}-${p.toMemberId}`} className="gap-2 rounded-xl border border-line p-3 dark:border-line-dark">
                      <Row className="justify-between gap-2">
                        <Text className="flex-1">
                          <Text className="font-semibold">{iOwe ? 'You' : p.fromName}</Text> pay{iOwe ? '' : 's'}{' '}
                          <Text className="font-semibold">{meId === p.toMemberId ? 'you' : p.toName}</Text>
                        </Text>
                        <Text variant="money" className="text-lg">
                          {money(p.amountMinor)}
                        </Text>
                      </Row>
                      <StatusPill status={p.status} />
                      {iOwe && p.status === 'unpaid' ? (
                        <>
                          {p.upiUri ? <Button title={`Pay ${money(p.amountMinor)} via UPI`} onPress={() => payWithUpi(p.upiUri!)} /> : null}
                          <Button variant="secondary" title="I’ve paid" loading={pay.isPending} onPress={() => pay.mutate({ fromMemberId: p.fromMemberId, toMemberId: p.toMemberId, status: 'marked' })} />
                        </>
                      ) : null}
                      {iGet && !iOwe ? (
                        <Button
                          variant={p.status === 'marked' ? 'primary' : 'secondary'}
                          title={p.status === 'marked' ? 'Confirm I got it' : 'Mark as received'}
                          onPress={() => pay.mutate({ fromMemberId: p.fromMemberId, toMemberId: p.toMemberId, status: 'confirmed' })}
                        />
                      ) : null}
                      {iOwe && !p.upiUri && t.baseCurrency === 'INR' ? <Text variant="small">{p.toName} hasn’t added a UPI ID to this trip.</Text> : null}
                    </View>
                  );
                })}
              </>
            )}
            {t.confirmedPayments.length ? (
              <View className="gap-1 border-t border-line pt-2 dark:border-line-dark">
                <Text variant="small">Already paid</Text>
                {t.confirmedPayments.map((c) => (
                  <Row key={c.id} className="justify-between">
                    <Text variant="muted">
                      {c.fromName} paid {c.toName}
                    </Text>
                    <Text variant="muted">{money(c.amountMinor)}</Text>
                  </Row>
                ))}
              </View>
            ) : null}
            {pay.error ? <Text className="text-danger dark:text-danger-dark">{(pay.error as Error).message}</Text> : null}
          </Card>
        ) : null}

        {tab === 'balances' ? (
          <Card className="gap-1">
            <Row className="pb-1">
              <Text variant="small" className="flex-1">
                Who
              </Text>
              <Text variant="small" className="w-24 text-right">
                Paid
              </Text>
              <Text variant="small" className="w-24 text-right">
                Share
              </Text>
              <Text variant="small" className="w-24 text-right">
                Net
              </Text>
            </Row>
            {t.balances.map((b) => (
              <Row key={b.memberId} className="border-t border-line py-2 dark:border-line-dark">
                <Text className="flex-1" numberOfLines={1}>
                  {b.memberId === meId ? 'You' : b.name}
                </Text>
                <Text className="w-24 text-right text-sm">{money(b.paidMinor)}</Text>
                <Text className="w-24 text-right text-sm">{money(b.owedMinor)}</Text>
                <Text className={`w-24 text-right text-sm font-semibold ${b.netMinor > 0 ? 'text-ok dark:text-ok-dark' : b.netMinor < 0 ? 'text-danger dark:text-danger-dark' : ''}`}>
                  {money(b.netMinor)}
                </Text>
              </Row>
            ))}
            <Text variant="small" className="pt-2">
              Net is what the others owe that person after confirmed payments. Bills in other currencies use the rate saved with each bill.
            </Text>
          </Card>
        ) : null}

        {tab === 'timeline' ? (
          <Card className="p-0">
            {t.bills.length === 0 ? (
              <View className="p-4">
                <Text variant="muted">No bills yet.</Text>
              </View>
            ) : (
              t.bills.map((b, i) => (
                <Pressable key={b.slug} onPress={() => router.push(`/b/${b.slug}`)} accessibilityRole="button" className={`min-h-14 flex-row items-center gap-3 px-4 py-3 ${i ? 'border-t border-line dark:border-line-dark' : ''}`}>
                  <View className="flex-1">
                    <Text className="font-medium" numberOfLines={1}>
                      {b.title}
                    </Text>
                    <Text variant="small" numberOfLines={1}>
                      {new Date(b.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {b.payerName} paid · {b.sourceLabel}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text variant="money">{money(b.totalBaseMinor)}</Text>
                    {b.currency !== t.baseCurrency ? <Text variant="small">{formatMoney(b.totalMinor, b.currency)}</Text> : null}
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        ) : null}

        {meId ? (
          <Card className="gap-3">
            <Text variant="h2">Invite people</Text>
            <ShareLink url={t.url} title={t.name} message={`Join “${t.name}” on Tabby to see the bills and settle up:`} />
            <Input label="Add someone by name" value={newMember} onChangeText={setNewMember} placeholder="They can take this seat when they join" onSubmitEditing={addMember} />
            <Button variant="secondary" title="Add" onPress={addMember} disabled={!newMember.trim()} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
