import { Image, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { formatMoney } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, EmptyState, ErrorBox, Row, Skeleton, Text } from '@/components/ui';
import { useBills, useMe, useTrips } from '@/lib/queries';
import type { BillView } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const me = useMe();
  const bills = useBills();
  const trips = useTrips();
  const loading = (bills.isLoading && !bills.data) || (trips.isLoading && !trips.data);
  const name = me.data?.me.displayName;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brandsoft dark:bg-brandsoft-dark"
            >
              {me.data?.me.image ? (
                <Image source={{ uri: me.data.me.image }} style={{ width: 40, height: 40 }} />
              ) : (
                <Text className="font-semibold text-brand dark:text-brand-dark">{(name ?? '?').slice(0, 1).toUpperCase()}</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <Screen
        onRefresh={() => {
          void bills.refetch();
          void trips.refetch();
          void me.refetch();
        }}
        refreshing={bills.isRefetching || trips.isRefetching}
        footer={
          <Row className="gap-3">
            <Button className="flex-1" title="New bill" icon="＋" onPress={() => router.push('/new')} />
            <Button className="flex-1" variant="secondary" title="New trip" onPress={() => router.push('/trip-new')} />
          </Row>
        }
      >
        <Text variant="muted">{name ? `Hi ${name}.` : 'Hi there.'} Here’s everything you’re splitting.</Text>

        {bills.error && !bills.data ? <ErrorBox message={(bills.error as Error).message} onRetry={() => bills.refetch()} /> : null}

        {loading ? (
          <Skeleton rows={5} />
        ) : (
          <>
            {(trips.data?.trips.length ?? 0) > 0 && (
              <View className="gap-2">
                <Text variant="h2">Trips</Text>
                {trips.data!.trips.map((t) => {
                  const mine = t.balances.find((b) => b.memberId === t.meMemberId);
                  return (
                    <Pressable key={t.slug} onPress={() => router.push(`/t/${t.slug}`)} accessibilityRole="button">
                      <Card className="gap-1">
                        <Row className="justify-between gap-2">
                          <Text variant="h2" className="flex-1" numberOfLines={1}>
                            {t.name}
                          </Text>
                          {t.settledAt ? <Badge tone="ok" label="Settled" /> : t.isDemo ? <Badge tone="warn" label="Demo" /> : null}
                        </Row>
                        <Text variant="muted">
                          {t.members.length} people · {t.bills.length} bills
                          {mine && mine.netMinor !== 0
                            ? ` · ${mine.netMinor > 0 ? 'you’re owed' : 'you owe'} ${formatMoney(Math.abs(mine.netMinor), t.baseCurrency)}`
                            : mine
                              ? ' · you’re even'
                              : ''}
                        </Text>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View className="gap-2">
              <Text variant="h2">Bills</Text>
              {bills.bills.length === 0 ? (
                <Card>
                  <EmptyState
                    title="No bills yet"
                    body="Scan a receipt, share an order from Swiggy or Zomato, or type one in. Friends claim their items from a link."
                  />
                </Card>
              ) : (
                bills.bills.map((b) => <BillRow key={b.slug} bill={b} onPress={() => router.push(`/b/${b.slug}`)} />)
              )}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

function BillRow({ bill, onPress }: { bill: BillView; onPress: () => void }) {
  const unclaimed = bill.totals.unclaimedMinor;
  const owedToMe = bill.isHost
    ? bill.participants.filter((p) => !p.isHost && p.status !== 'confirmed').reduce((a, p) => a + p.totalMinor, 0)
    : 0;
  const me = bill.participants.find((p) => p.id === bill.meParticipantId);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card className="gap-1">
        <Row className="justify-between gap-3">
          <Text className="flex-1 font-semibold" numberOfLines={1}>
            {bill.title}
          </Text>
          <Text variant="money">{formatMoney(bill.totals.totalMinor, bill.currency)}</Text>
        </Row>
        <Row className="flex-wrap gap-2">
          <Badge label={bill.sourceLabel} />
          {bill.pending ? <Badge tone="warn" label="Waiting to sync" /> : null}
          {bill.isDemo ? <Badge tone="warn" label="Demo" /> : null}
        </Row>
        <Text variant="small">
          {bill.isHost
            ? owedToMe > 0
              ? `${formatMoney(owedToMe, bill.currency)} still to come back to you`
              : unclaimed && !bill.pending
                ? `${formatMoney(unclaimed, bill.currency)} not claimed yet`
                : 'All settled'
            : me
              ? `Your share ${formatMoney(me.totalMinor, bill.currency)}`
              : `Paid by ${bill.payee.name}`}
        </Text>
      </Card>
    </Pressable>
  );
}
