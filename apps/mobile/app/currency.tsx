import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PINNED_CURRENCIES, searchCurrencies } from '@tabby/core';
import { Input, Text } from '@/components/ui';
import { currencyPick } from '@/lib/pick';

export default function CurrencyPicker() {
  const router = useRouter();
  const { current } = useLocalSearchParams<{ current?: string }>();
  const [q, setQ] = useState('');
  const list = useMemo(() => searchCurrencies(q), [q]);

  return (
    <View className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="w-full max-w-2xl self-center px-4 pb-2 pt-3">
        <Input value={q} onChangeText={setQ} placeholder="Search by code or name" autoFocus accessibilityLabel="Search currencies" autoCorrect={false} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-2xl self-center px-4 pb-8"
        renderItem={({ item, index }) => (
          <>
            {!q && index === PINNED_CURRENCIES.length ? (
              <Text variant="small" className="pb-1 pt-4">
                All currencies
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                currencyPick.choose(item.code);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: item.code === current }}
              className="min-h-12 flex-row items-center gap-3 border-b border-line py-2 dark:border-line-dark"
            >
              <Text className="w-12 font-semibold">{item.code}</Text>
              <Text className="flex-1" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="muted">{item.symbol}</Text>
              {item.code === current ? <Text className="text-brand dark:text-brand-dark">✓</Text> : null}
            </Pressable>
          </>
        )}
      />
    </View>
  );
}
