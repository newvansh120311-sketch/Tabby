import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-6 dark:bg-bg-dark">
        <Text variant="h2">That link didn’t lead anywhere</Text>
        <Text variant="muted" className="text-center">It may have been cut off when it was copied.</Text>
        <Link href="/" className="text-brand dark:text-brand-dark">Go to your bills</Link>
      </View>
    </>
  );
}
