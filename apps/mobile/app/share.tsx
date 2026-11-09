import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { detectPlatform, getCurrency, parseOrder, SOURCE_LABELS, type BillDraft } from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, ErrorBox, Row, Text } from '@/components/ui';
import { draftStore, fromParsed } from '@/lib/draft';
import { readImage } from '@/lib/ocr';
import { useMe, useTrips } from '@/lib/queries';
import { TabbyNative } from '../modules/tabby-native';

type Step = 'reading' | 'detecting' | 'done' | 'error';

export default function ShareReceived() {
  const router = useRouter();
  const { shareIntent, resetShareIntent, hasShareIntent } = useShareIntentContext();
  const me = useMe();
  const trips = useTrips();
  const [step, setStep] = useState<Step>('reading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [tripSlug, setTripSlug] = useState<string | null>(null);
  const started = useRef(false);
  const currency = me.data?.me.defaultCurrency ?? 'INR';

  useEffect(() => {
    if (!hasShareIntent || started.current) return;
    started.current = true;
    (async () => {
      try {
        const sender = TabbyNative.getReferrerPackage();
        const file = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
        let text = [shareIntent.text, shareIntent.webUrl].filter(Boolean).join('\n');
        if (file) {
          setStep('reading');
          const uri = file.path.startsWith('file://') || file.path.startsWith('content://') ? file.path : `file://${file.path}`;
          text = `${text}\n${await readImage(uri)}`;
        }
        if (!text.trim()) throw new Error('Nothing readable came through. Try sharing a screenshot of the order summary.');
        setStep('detecting');
        const source = detectPlatform(text, sender);
        const parsed = parseOrder(text, { packageName: sender, source, defaultCurrency: currency });
        setDraft(parsed);
        setStep('done');
      } catch (e) {
        setError((e as Error).message);
        setStep('error');
      }
    })();
  }, [hasShareIntent, shareIntent, currency]);

  const openTrips = (trips.data?.trips ?? []).filter((t) => !t.settledAt && t.meMemberId);

  function review() {
    if (!draft) return;
    const trip = openTrips.find((t) => t.slug === tripSlug);
    draftStore.set(
      fromParsed(draft, getCurrency(draft.currency).decimals, trip ? { tripSlug: trip.slug, payerMemberId: trip.meMemberId ?? undefined } : {}),
    );
    resetShareIntent();
    router.replace('/review');
  }

  if (!hasShareIntent && step !== 'done') {
    return (
      <Screen>
        <Text variant="muted">Nothing was shared. Use Share in another app and pick Tabby.</Text>
        <Button title="Go home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen footer={step === 'done' ? <Button title="Check the bill" onPress={review} /> : undefined}>
      <Card className="gap-3">
        <Progress label="Reading what you shared" state={step === 'reading' ? 'active' : step === 'error' && !draft ? 'error' : 'done'} />
        <Progress label="Working out which app it came from" state={step === 'detecting' ? 'active' : step === 'done' ? 'done' : 'waiting'} />
        <Progress label="Pulling out items, fees and discounts" state={step === 'done' ? 'done' : 'waiting'} />
      </Card>

      {error ? (
        <>
          <ErrorBox message={error} />
          <Button
            variant="secondary"
            title="Type the bill in instead"
            onPress={() => {
              resetShareIntent();
              router.replace('/new');
            }}
          />
        </>
      ) : null}

      {draft ? (
        <Card className="gap-2">
          <Row className="justify-between">
            <Badge tone="brand" label={SOURCE_LABELS[draft.source]} />
            <Text variant="small">{Math.round(draft.confidence * 100)}% sure</Text>
          </Row>
          <Text>
            Found {draft.items.length} item{draft.items.length === 1 ? '' : 's'} and {draft.charges.length} fee
            {draft.charges.length === 1 ? '' : 's'} or discount{draft.charges.length === 1 ? '' : 's'}.
          </Text>
          {draft.warnings.map((w) => (
            <Text key={w} variant="small" className="text-warn dark:text-warn-dark">
              {w}
            </Text>
          ))}
        </Card>
      ) : null}

      {draft && openTrips.length > 0 ? (
        <View className="gap-2">
          <Text variant="h2">Add it to a trip?</Text>
          <Pressable onPress={() => setTripSlug(null)} accessibilityRole="radio" accessibilityState={{ checked: tripSlug === null }}>
            <Card className={tripSlug === null ? 'border-brand dark:border-brand-dark' : ''}>
              <Text>No, it’s a bill on its own</Text>
            </Card>
          </Pressable>
          {openTrips.map((t) => (
            <Pressable key={t.slug} onPress={() => setTripSlug(t.slug)} accessibilityRole="radio" accessibilityState={{ checked: tripSlug === t.slug }}>
              <Card className={tripSlug === t.slug ? 'border-brand dark:border-brand-dark' : ''}>
                <Text className="font-medium">{t.name}</Text>
                <Text variant="small">{t.members.map((m) => m.name).join(', ')}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function Progress({ label, state }: { label: string; state: 'waiting' | 'active' | 'done' | 'error' }) {
  return (
    <Row className="gap-3">
      <View className="h-6 w-6 items-center justify-center">
        {state === 'active' ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className={state === 'done' ? 'text-ok dark:text-ok-dark' : state === 'error' ? 'text-danger dark:text-danger-dark' : 'text-muted dark:text-muted-dark'}>
            {state === 'done' ? '✓' : state === 'error' ? '!' : '○'}
          </Text>
        )}
      </View>
      <Text variant={state === 'waiting' ? 'muted' : 'body'}>{label}</Text>
    </Row>
  );
}
