import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Text } from '@/components/ui';
import { prefs } from '@/lib/storage';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queries';
import type { TripView } from '@/lib/types';

const PAGES = [
  {
    art: '🧾',
    title: 'Whoever paid scans the bill',
    body: 'Point the camera at the receipt or pick a photo. Tabby reads the items and prices, plus the tax and total, and you fix anything it got wrong.',
  },
  {
    art: '🛵',
    title: 'Ordered on Swiggy or Zomato?',
    body: 'Screenshot the order summary in the delivery app, tap Share and pick Tabby. Delivery fees, coupons and the tip come across too.',
  },
  {
    art: '🤝',
    title: 'Friends tap what they had',
    body: 'Send the link. Everyone sees their share as it changes, and in rupees they get a button that opens their UPI app with the exact amount filled in.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = PAGES[i];
  const last = i === PAGES.length - 1;

  const finish = () => {
    prefs.setOnboarded();
    router.replace('/');
  };

  async function demo() {
    setLoading(true);
    setError(null);
    try {
      const { trip } = await api<{ trip: TripView }>('/api/demo', { method: 'POST' });
      prefs.setOnboarded();
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.replace('/');
      router.push(`/t/${trip.slug}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="w-full max-w-lg flex-1 justify-between self-center px-6 py-6">
        <View className="items-end">
          {!last ? <Button variant="ghost" title="Skip" onPress={finish} /> : <View className="h-12" />}
        </View>
        <View className="items-center gap-4">
          <Text style={{ fontSize: Math.min(88, width * 0.2), lineHeight: Math.min(88, width * 0.2) * 1.3 }} accessibilityElementsHidden importantForAccessibility="no">
            {page.art}
          </Text>
          <Text variant="title" className="text-center">
            {page.title}
          </Text>
          <Text variant="muted" className="text-center text-base">
            {page.body}
          </Text>
        </View>
        <View className="gap-3">
          <View className="flex-row justify-center gap-2" accessibilityLabel={`Page ${i + 1} of ${PAGES.length}`}>
            {PAGES.map((_, k) => (
              <View key={k} className={`h-2 rounded-full ${k === i ? 'w-6 bg-brand dark:bg-brand-dark' : 'w-2 bg-line dark:bg-line-dark'}`} />
            ))}
          </View>
          {error ? <Text className="text-center text-danger dark:text-danger-dark">{error}</Text> : null}
          {last ? (
            <>
              <Button title="Get started" onPress={finish} />
              <Button variant="secondary" title="Try a demo trip" loading={loading} onPress={demo} />
            </>
          ) : (
            <Button title="Next" onPress={() => setI(i + 1)} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
