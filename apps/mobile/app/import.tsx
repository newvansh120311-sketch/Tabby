import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { getCurrency, parseOrder } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Button, Input, Text } from '@/components/ui';
import { draftStore, fromParsed } from '@/lib/draft';
import { useMe, useTrip } from '@/lib/queries';

export default function ImportText() {
  const router = useRouter();
  const { trip: tripSlug } = useLocalSearchParams<{ trip?: string }>();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const me = useMe();
  const trip = useTrip(tripSlug ?? '');
  const currency = (tripSlug && trip.data?.baseCurrency) || me.data?.me.defaultCurrency || 'INR';

  function go() {
    if (!text.trim()) return setError('Paste the order text first.');
    const parsed = parseOrder(text, { defaultCurrency: currency });
    if (parsed.items.length === 0 && parsed.charges.length === 0) {
      return setError('We couldn’t find any prices in that text. Check it includes the bill details, or type the bill in.');
    }
    draftStore.set(
      fromParsed(parsed, getCurrency(parsed.currency).decimals, tripSlug ? { tripSlug, payerMemberId: trip.data?.meMemberId ?? undefined } : {}),
    );
    router.replace('/review');
  }

  return (
    <Screen footer={<Button title="Read this order" onPress={go} />}>
      <Text variant="muted">
        Copy the order details from the delivery app, or the body of an order confirmation email, and paste it here.
      </Text>
      <Button
        variant="secondary"
        title="Paste from clipboard"
        onPress={async () => {
          setText(await Clipboard.getStringAsync());
          setError(null);
        }}
      />
      <Input
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        multiline
        textAlignVertical="top"
        placeholder={'2 x Masala Dosa ₹330\nItem Total ₹330\nDelivery Fee ₹25\nTo Pay ₹355'}
        className="min-h-64 py-3"
        accessibilityLabel="Order text"
        error={error}
      />
    </Screen>
  );
}
