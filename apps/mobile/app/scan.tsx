import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrency, parseOrder } from '@tabby/core';
import { Button, Text } from '@/components/ui';
import { draftStore, fromParsed } from '@/lib/draft';
import { readImage } from '@/lib/ocr';
import { useMe, useTrip } from '@/lib/queries';

export default function Scan() {
  const router = useRouter();
  const { trip: tripSlug } = useLocalSearchParams<{ trip?: string }>();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = useMe();
  const trip = useTrip(tripSlug ?? '');
  const currency = (tripSlug && trip.data?.baseCurrency) || me.data?.me.defaultCurrency || 'INR';

  async function capture() {
    if (!cam.current) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!photo) throw new Error('The camera didn’t return a photo. Try again.');
      const text = await readImage(photo.uri);
      const parsed = parseOrder(text, { defaultCurrency: currency, source: 'receipt' });
      draftStore.set(
        fromParsed(parsed, getCurrency(parsed.currency).decimals, tripSlug ? { tripSlug, payerMemberId: trip.data?.meMemberId ?? undefined } : {}),
      );
      router.replace('/review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!perm) return <View className="flex-1 bg-black" />;
  if (!perm.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg px-6 dark:bg-bg-dark">
        <Text variant="h2" className="text-center">
          Tabby needs the camera to read receipts
        </Text>
        <Text variant="muted" className="text-center">
          Photos stay on your phone. Only the text Tabby reads from them is saved with the bill.
        </Text>
        {perm.canAskAgain ? (
          <Button title="Allow camera" onPress={requestPerm} />
        ) : (
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        )}
        <Button variant="ghost" title="Go back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cam} style={{ flex: 1 }} facing="back" autofocus="on" />
      <SafeAreaView edges={['top', 'bottom']} className="absolute inset-0 justify-between px-5 py-4" pointerEvents="box-none">
        <View className="flex-row justify-between">
          <Button variant="secondary" title="Close" onPress={() => router.back()} />
        </View>
        <View className="items-center gap-3">
          <View className="rounded-xl bg-black/60 px-4 py-2">
            <Text className="text-center text-white">
              {busy ? 'Reading the receipt…' : 'Fit the whole receipt in the frame, flat and in good light.'}
            </Text>
          </View>
          {error ? (
            <View className="rounded-xl bg-black/70 px-4 py-2">
              <Text className="text-center text-white">{error}</Text>
            </View>
          ) : null}
          {busy ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <Button title="Take photo" onPress={capture} className="w-56" accessibilityLabel="Take a photo of the receipt" />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
