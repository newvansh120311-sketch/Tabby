import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getCurrency, parseOrder, type BillSource } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Card, ErrorBox, Row, Text } from '@/components/ui';
import { draftStore, emptyDraft, fromParsed } from '@/lib/draft';
import { useMe, useTrip } from '@/lib/queries';
import { readImage } from '@/lib/ocr';
import { TabbyNative } from '../modules/tabby-native';

// Launch shortcuts for ordering together. Opening another app this way is all we do; no data is read from it.
export const ORDER_APPS: { pkg: string; source: BillSource; label: string }[] = [
  { pkg: 'in.swiggy.android', source: 'swiggy', label: 'Swiggy' },
  { pkg: 'com.application.zomato', source: 'zomato', label: 'Zomato' },
  { pkg: 'com.zeptoconsumerapp', source: 'zepto', label: 'Zepto' },
  { pkg: 'com.grofers.customerapp', source: 'blinkit', label: 'Blinkit' },
  { pkg: 'com.application.zomato.district', source: 'district', label: 'District' },
  { pkg: 'com.eazydiner', source: 'eazydiner', label: 'EazyDiner' },
];

export default function NewBill() {
  const router = useRouter();
  const { trip: tripSlug } = useLocalSearchParams<{ trip?: string }>();
  const me = useMe();
  const trip = useTrip(tripSlug ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = (tripSlug && trip.data?.baseCurrency) || me.data?.me.defaultCurrency || 'INR';
  const installed = useMemo(() => ORDER_APPS.filter((a) => TabbyNative.isInstalled(a.pkg)), []);
  const ctx = tripSlug ? { tripSlug, payerMemberId: trip.data?.meMemberId ?? undefined } : {};

  async function fromGallery() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setBusy('Reading the receipt…');
    try {
      const text = await readImage(res.assets[0].uri);
      const parsed = parseOrder(text, { defaultCurrency: currency });
      draftStore.set(fromParsed(parsed, getCurrency(parsed.currency).decimals, ctx));
      router.replace('/review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const options = [
    { icon: '📷', title: 'Scan a receipt', body: 'Use the camera on a paper bill.', onPress: () => router.replace({ pathname: '/scan', params: tripSlug ? { trip: tripSlug } : {} }) },
    { icon: '🖼️', title: 'Pick a photo or screenshot', body: 'A receipt photo, or a screenshot of an order.', onPress: fromGallery },
    { icon: '📋', title: 'Paste order or email text', body: 'Copied order details or a confirmation email.', onPress: () => router.replace({ pathname: '/import', params: tripSlug ? { trip: tripSlug } : {} }) },
    {
      icon: '✏️',
      title: 'Type it in',
      body: 'No receipt, or the scan didn’t work out.',
      onPress: () => {
        draftStore.set(emptyDraft(currency, ctx));
        router.replace('/review');
      },
    },
  ];

  return (
    <Screen>
      {error ? <ErrorBox message={error} /> : null}
      {busy ? <Text variant="muted">{busy}</Text> : null}
      {options.map((o) => (
        <Pressable key={o.title} onPress={o.onPress} disabled={!!busy} accessibilityRole="button">
          <Card>
            <Row className="gap-3">
              <Text className="text-2xl" importantForAccessibility="no">
                {o.icon}
              </Text>
              <View className="flex-1">
                <Text className="font-semibold">{o.title}</Text>
                <Text variant="muted">{o.body}</Text>
              </View>
            </Row>
          </Card>
        </Pressable>
      ))}

      {tripSlug ? (
        <View className="gap-2">
          <Text variant="h2">Order together</Text>
          {installed.length ? (
            <>
              <Text variant="muted">
                Open the app, place the order, then share the order summary back to Tabby and pick this trip.
              </Text>
              <Row className="flex-wrap gap-2">
                {installed.map((a) => (
                  <Pressable
                    key={a.pkg}
                    accessibilityRole="button"
                    onPress={() => TabbyNative.launchApp(a.pkg)}
                    className="min-h-12 justify-center rounded-xl border border-line px-4 dark:border-line-dark"
                  >
                    <Text className="font-medium">Open in {a.label}</Text>
                  </Pressable>
                ))}
              </Row>
            </>
          ) : (
            <Text variant="muted">None of the delivery apps Tabby knows about ({ORDER_APPS.map((a) => a.label).join(', ')}) are on this phone.</Text>
          )}
          <Text variant="small">Tabby only opens these apps. It never reads your accounts in them.</Text>
        </View>
      ) : null}
    </Screen>
  );
}
