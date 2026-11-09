import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrency } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Button, Input, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { currencyPick } from '@/lib/pick';
import { queryClient, useMe } from '@/lib/queries';
import type { TripView } from '@/lib/types';

export default function NewTrip() {
  const router = useRouter();
  const me = useMe();
  const [name, setName] = useState('');
  const [you, setYou] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [others, setOthers] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setYou((v) => v || me.data.me.displayName || '');
      setCurrency(me.data.me.defaultCurrency);
    }
  }, [me.data]);

  async function create() {
    if (!name.trim()) return setError('Name the trip, like “Goa, December”.');
    if (!you.trim()) return setError('Add your own name so others know who made it.');
    setSaving(true);
    setError(null);
    try {
      const { trip } = await api<{ trip: TripView }>('/api/trips', {
        method: 'POST',
        json: { name: name.trim(), baseCurrency: currency, ownerName: you.trim(), ownerUpiId: me.data?.me.upiId ?? '' },
      });
      const add = others.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      if (add.length) await api(`/api/trips/${trip.slug}/members`, { method: 'POST', json: { add } });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.replace(`/t/${trip.slug}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const cur = getCurrency(currency);
  return (
    <Screen footer={<Button title="Create trip" loading={saving} onPress={create} />}>
      <Input label="Trip name" value={name} onChangeText={setName} placeholder="Goa, December" maxLength={80} />
      <Input label="Your name" value={you} onChangeText={setYou} placeholder="Your name" maxLength={60} />
      <View className="gap-1">
        <Text variant="muted">Main currency</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            currencyPick.open(setCurrency);
            router.push({ pathname: '/currency', params: { current: currency } });
          }}
          className="min-h-12 flex-row items-center justify-between rounded-xl border border-line px-3 dark:border-line-dark"
        >
          <Text>
            {cur.code} · {cur.name}
          </Text>
          <Text variant="muted">Change</Text>
        </Pressable>
        <Text variant="small">Bills in other currencies get converted to this one.</Text>
      </View>
      <Input
        label="Who else is coming? (optional)"
        value={others}
        onChangeText={setOthers}
        placeholder="Priya, Marcus, Jen"
        hint="Separate names with commas. Each person picks their name when they open the invite."
      />
      {error ? <Text className="text-danger dark:text-danger-dark">{error}</Text> : null}
    </Screen>
  );
}
