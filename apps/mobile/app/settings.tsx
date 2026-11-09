import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { getCurrency, isValidVpa } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, Input, Row, Text } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { googleConfigured, signInWithGoogle, signOut } from '@/lib/auth';
import { enqueue, newId } from '@/lib/outbox';
import { currencyPick } from '@/lib/pick';
import { queryClient, useMe } from '@/lib/queries';
import type { Me } from '@/lib/types';

export default function Settings() {
  const router = useRouter();
  const me = useMe();
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [upi, setUpi] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const m = me.data?.me;
    if (!m) return;
    setDisplayName(m.displayName ?? '');
    setCurrency(m.defaultCurrency);
    setUpi(m.upiId ?? '');
  }, [me.data?.me]);

  const upiError = upi.trim() && !isValidVpa(upi.trim()) ? 'That doesn’t look like a UPI ID. It should look like name@bank.' : null;
  const nameError = !displayName.trim() ? 'Add the name friends know you by.' : null;

  async function save() {
    if (upiError || nameError) return;
    const payload = { displayName: displayName.trim(), defaultCurrency: currency, upiId: upi.trim() || null };
    setSaving(true);
    try {
      const { me: m } = await api<{ me: Me }>('/api/me', { method: 'PUT', json: payload });
      queryClient.setQueryData(['me'], (old: { me: Me; googleConfigured: boolean } | undefined) => ({ googleConfigured: old?.googleConfigured ?? false, me: m }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        enqueue({ id: newId(), kind: 'settings', payload, createdAt: Date.now() });
        setSaved(true);
      } else Alert.alert('Couldn’t save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function google() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Sign-in didn’t work', (e as Error).message);
    } finally {
      setSigningIn(false);
    }
  }

  const m = me.data?.me;
  const cur = getCurrency(currency);
  return (
    <Screen footer={<Button title={saved ? 'Saved' : 'Save settings'} loading={saving} disabled={!!upiError || !!nameError} onPress={save} />}>
      <Card className="gap-3">
        <Text variant="h2">Account</Text>
        {m?.signedIn ? (
          <Row className="gap-3">
            {m.image ? <Image source={{ uri: m.image }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : null}
            <View className="flex-1">
              <Text className="font-medium">{m.displayName}</Text>
              <Text variant="muted">{m.email}</Text>
            </View>
            <Button variant="ghost" title="Sign out" onPress={signOut} />
          </Row>
        ) : googleConfigured ? (
          <>
            <Text variant="muted">Sign in to keep your bills and trips on every phone you use. Everything works without it too.</Text>
            <Button variant="secondary" title="Sign in with Google" loading={signingIn} onPress={google} />
          </>
        ) : (
          <>
            <Button variant="secondary" title="Sign-in not configured" disabled />
            <Text variant="small">Your bills are kept with this phone and still sync to the server, so share links work as usual.</Text>
          </>
        )}
      </Card>

      <Card className="gap-3">
        <Input label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="What friends call you" error={displayName ? nameError : null} maxLength={60} />
        <View className="gap-1">
          <Text variant="muted">Default currency for new bills</Text>
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
        </View>
        <Input
          label="Your UPI ID"
          value={upi}
          onChangeText={setUpi}
          placeholder="yourname@okaxis"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          error={upiError}
          hint="Friends get a Pay via UPI button with your ID and the exact amount. Only used for bills in rupees."
        />
        {m?.isDemo ? <Badge tone="warn" label="Demo account: this UPI ID isn’t real" /> : null}
      </Card>

      <Text variant="small" className="text-center">
        Tabby {Application.nativeApplicationVersion} ({Application.nativeBuildVersion}) · update {Updates.updateId?.slice(0, 8) ?? 'built in'} ·{' '}
        {Updates.channel ?? 'local'}
      </Text>
    </Screen>
  );
}
