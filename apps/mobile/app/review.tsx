import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CHARGE_LABELS,
  CHARGE_TYPES,
  checkTotals,
  DEFAULT_FEE_RULES,
  formatMoney,
  getCurrency,
  NEGATIVE_CHARGE_TYPES,
  parseMoney,
  SOURCE_LABELS,
  taxLines,
  tipAmount,
  type BillWrite,
  type ChargeType,
  type FeeRule,
} from '@tabby/core';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, Chip, Input, Row, Text } from '@/components/ui';
import { draftStore, key, lastTax, useDraft, type EditableDraft } from '@/lib/draft';
import { api } from '@/lib/api';
import { currencyPick } from '@/lib/pick';
import { createBill, updateBill, useMe, useTrip } from '@/lib/queries';

const RULE_LABEL: Record<FeeRule, string> = { even: 'Evenly', proportional: 'By what they ordered', claims: 'Only people who claimed' };
const TIP_PRESETS = [5, 10, 15, 18, 20];
// Common GST slabs on Indian food bills; other currencies get the custom rate.
const TAX_PRESETS = ['5', '12', '18'];

export default function Review() {
  const router = useRouter();
  const draft = useDraft();
  const me = useMe();
  const trip = useTrip(draft?.tripSlug ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fxNote, setFxNote] = useState<string | null>(null);

  const d = draft;
  const cur = d ? getCurrency(d.currency) : getCurrency('INR');
  const set = (fn: (x: EditableDraft) => EditableDraft) => draftStore.update(fn);
  const tripView = d?.tripSlug ? trip.data : undefined;
  const needsFx = !!tripView && d?.currency !== tripView.baseCurrency;

  // Fetch a rate when a trip bill is in another currency. It's saved with the bill and can be edited.
  useEffect(() => {
    if (!needsFx || !d || !tripView || d.fxRate) return;
    api<{ rate: number | null; date?: string; error?: string }>(`/api/fx?from=${d.currency}&to=${tripView.baseCurrency}`)
      .then((r) => {
        if (r.rate) {
          set((x) => ({ ...x, fxRate: String(r.rate) }));
          setFxNote(`Rate from ${r.date}. Change it if you paid a different rate.`);
        } else setFxNote(r.error ?? 'Type the exchange rate in.');
      })
      .catch(() => setFxNote('You look offline, so type the exchange rate in.'));
  }, [needsFx, d?.currency, tripView?.baseCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  const computed = useMemo(() => {
    if (!d) return null;
    const items = d.items.map((i) => ({ ...i, minor: parseMoney(i.amount, d.currency) }));
    const charges = d.charges.map((c) => {
      const m = parseMoney(c.amount, d.currency);
      return { ...c, minor: m == null ? null : NEGATIVE_CHARGE_TYPES.includes(c.type) ? -Math.abs(m) : m };
    });
    const itemsTotal = items.reduce((a, i) => a + (i.minor ?? 0), 0);
    const tip =
      d.tip.mode === 'none'
        ? 0
        : d.tip.mode === 'percent'
          ? tipAmount(itemsTotal, { mode: 'percent', percent: d.tip.percent })
          : (parseMoney(d.tip.amount, d.currency) ?? 0);
    const tax =
      d.tax.mode === 'percent'
        ? taxLines(itemsTotal, Number(d.tax.percent), { currency: d.currency, splitGst: d.tax.splitGst })
        : d.tax.mode === 'fixed' && (parseMoney(d.tax.amount, d.currency) ?? 0) > 0
          ? [{ label: d.currency === 'INR' ? 'GST' : 'Tax', amountMinor: parseMoney(d.tax.amount, d.currency)! }]
          : [];
    const taxTotal = tax.reduce((a, t) => a + t.amountMinor, 0);
    const allCharges = [...charges.map((c) => ({ amountMinor: c.minor ?? 0 })), { amountMinor: tip }, { amountMinor: taxTotal }];
    const check = checkTotals(items.map((i) => ({ amountMinor: i.minor ?? 0 })), allCharges, d.detectedTotalMinor);
    return { items, charges, tip, tax, taxTotal, itemsTotal, check };
  }, [d]);

  if (!d || !computed) {
    return (
      <Screen>
        <Text variant="muted">There’s no bill to check. Start a new one from the home screen.</Text>
        <Button title="Go home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const chargeTypesPresent = [
    ...new Set([
      ...d.charges.map((c) => c.type),
      ...(computed.tip ? (['tip'] as ChargeType[]) : []),
      ...(computed.taxTotal ? (['tax'] as ChargeType[]) : []),
    ]),
  ];
  const taxPercent = d.tax.mode === 'percent' ? Number(d.tax.percent) : null;
  const money = (m: number) => formatMoney(m, d.currency);

  async function save() {
    if (!d || !computed) return;
    const errs: Record<string, string> = {};
    if (!d.title.trim()) errs.title = 'Give the bill a name, like “Friday dinner”.';
    computed.items.forEach((i) => {
      if (!i.name.trim()) errs[`name-${i.key}`] = 'Add a name';
      if (i.minor == null || i.minor < 0) errs[`amt-${i.key}`] = 'Enter a price';
    });
    computed.charges.forEach((c) => {
      if (c.minor == null) errs[`amt-${c.key}`] = 'Enter an amount';
    });
    if (computed.items.length === 0) errs.items = 'Add at least one item.';
    if (d.tax.mode === 'percent' && !(Number(d.tax.percent) > 0 && Number(d.tax.percent) < 100)) errs.tax = 'Enter a tax rate, like 5.';
    const fx = needsFx ? Number(d.fxRate) : 1;
    if (needsFx && !(fx > 0)) errs.fx = 'Enter the exchange rate.';
    if (tripView && !d.payerMemberId) errs.payer = 'Pick who paid.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload: BillWrite = {
      title: d.title.trim(),
      merchant: d.merchant?.trim() || undefined,
      currency: d.currency,
      source: d.source,
      splitMode: d.splitMode,
      feeRules: d.feeRules,
      date: d.date,
      tripId: tripView?.id,
      payerMemberId: tripView ? d.payerMemberId : undefined,
      fxRateToBase: needsFx ? fx : undefined,
      detectedTotalMinor: d.detectedTotalMinor,
      items: computed.items.map((i) => ({ id: i.id, name: i.name.trim(), amountMinor: i.minor!, qty: i.qty || 1 })),
      charges: [
        ...computed.charges.map((c) => ({ type: c.type, label: c.label.trim() || CHARGE_LABELS[c.type], amountMinor: c.minor! })),
        ...computed.tax.map((t) => ({ type: 'tax' as const, label: t.label, amountMinor: t.amountMinor })),
        ...(computed.tip
          ? [{ type: 'tip' as const, label: d.tip.mode === 'percent' ? `Tip ${d.tip.percent}%` : 'Tip', amountMinor: computed.tip }]
          : []),
      ],
      hostName: me.data?.me.displayName ?? undefined,
      hostUpiId: me.data?.me.upiId ?? '',
      participants: [],
    };
    lastTax.set(d.tax);
    setSaving(true);
    try {
      if (d.editingSlug) {
        await updateBill(d.editingSlug, payload);
        draftStore.set(null);
        router.back();
      } else {
        const { slug, queued } = await createBill(payload);
        draftStore.set(null);
        router.replace(`/b/${slug}`);
        if (queued) Alert.alert('Saved on this phone', 'You’re offline, so the bill will upload and get its link once you reconnect.');
      }
    } catch (e) {
      Alert.alert('Couldn’t save the bill', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <View className="gap-2">
          <Row className="justify-between">
            <Text variant="muted">Total</Text>
            <Text variant="money" className="text-lg">
              {money(computed.check.computedMinor)}
            </Text>
          </Row>
          <Button testID="save-bill" title={d.editingSlug ? 'Save changes' : 'Save and share'} loading={saving} onPress={save} />
        </View>
      }
    >
      <Row className="flex-wrap gap-2">
        <Badge tone="brand" label={SOURCE_LABELS[d.source]} />
        {tripView ? <Badge label={`Trip: ${tripView.name}`} /> : null}
      </Row>

      {d.warnings.length > 0 && (
        <Card className="gap-1 border-warn dark:border-warn-dark">
          {d.warnings.map((w) => (
            <Text key={w} variant="muted">
              {w}
            </Text>
          ))}
        </Card>
      )}

      {!computed.check.matches && d.detectedTotalMinor != null && (
        <Card className="gap-1 border-warn bg-warnsoft dark:border-warn-dark dark:bg-warnsoft-dark" accessibilityLiveRegion="polite">
          <Text className="font-semibold text-warn dark:text-warn-dark">This doesn’t add up yet</Text>
          <Text className="text-warn dark:text-warn-dark">
            The receipt says {money(d.detectedTotalMinor)}, but the lines below come to {money(computed.check.computedMinor)} (
            {computed.check.differenceMinor > 0 ? 'over' : 'short'} by {money(Math.abs(computed.check.differenceMinor))}). Check for a
            misread price or a missing fee.
          </Text>
        </Card>
      )}

      <Card className="gap-3">
        <Input
          label="Name"
          testID="bill-title"
          value={d.title}
          onChangeText={(t) => set((x) => ({ ...x, title: t }))}
          placeholder="Friday dinner"
          error={errors.title}
          maxLength={80}
        />
        <Row className="gap-3">
          <View className="flex-1">
            <Text variant="muted">Currency</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Currency, ${cur.name}. Change`}
              onPress={() => {
                currencyPick.open((code) => set((x) => ({ ...x, currency: code, fxRate: undefined })));
                router.push({ pathname: '/currency', params: { current: d.currency } });
              }}
              className="mt-1 min-h-12 flex-row items-center justify-between rounded-xl border border-line px-3 dark:border-line-dark"
            >
              <Text>
                {cur.code} · {cur.symbol}
              </Text>
              <Text variant="muted">Change</Text>
            </Pressable>
          </View>
        </Row>
        <View className="gap-1">
          <Text variant="muted">How to split</Text>
          <Row className="flex-wrap gap-2">
            <Chip label="By item" selected={d.splitMode === 'items'} onPress={() => set((x) => ({ ...x, splitMode: 'items' }))} />
            <Chip label="Evenly" selected={d.splitMode === 'even'} onPress={() => set((x) => ({ ...x, splitMode: 'even' }))} />
          </Row>
        </View>
      </Card>

      {tripView ? (
        <Card className="gap-3">
          <Text variant="h2">Who paid?</Text>
          <Row className="flex-wrap gap-2">
            {tripView.members.map((m) => (
              <Chip key={m.id} label={m.id === tripView.meMemberId ? `${m.name} (you)` : m.name} selected={d.payerMemberId === m.id} onPress={() => set((x) => ({ ...x, payerMemberId: m.id }))} />
            ))}
          </Row>
          {errors.payer ? <Text className="text-danger dark:text-danger-dark">{errors.payer}</Text> : null}
          {needsFx ? (
            <Input
              label={`1 ${d.currency} in ${tripView.baseCurrency}`}
              keyboardType="decimal-pad"
              value={d.fxRate ?? ''}
              onChangeText={(t) => set((x) => ({ ...x, fxRate: t.replace(/[^\d.]/g, '') }))}
              hint={fxNote ?? 'Fetching today’s rate…'}
              error={errors.fx}
            />
          ) : null}
        </Card>
      ) : null}

      <Card className="gap-3">
        <Text variant="h2">Items</Text>
        {errors.items ? <Text className="text-danger dark:text-danger-dark">{errors.items}</Text> : null}
        {d.items.map((it, idx) => (
          <View key={it.key} className="gap-2 border-b border-line pb-3 dark:border-line-dark">
            <Input
              value={it.name}
              onChangeText={(t) => set((x) => ({ ...x, items: x.items.map((i) => (i.key === it.key ? { ...i, name: t } : i)) }))}
              placeholder={`Item ${idx + 1}`}
              testID={`item-name-${idx}`}
              accessibilityLabel={`Item ${idx + 1} name`}
              error={errors[`name-${it.key}`]}
            />
            <Row className="gap-2">
              <View className="w-20">
                <Input
                  value={String(it.qty)}
                  keyboardType="number-pad"
                  onChangeText={(t) => set((x) => ({ ...x, items: x.items.map((i) => (i.key === it.key ? { ...i, qty: Math.max(1, Math.min(999, Number(t.replace(/\D/g, '')) || 1)) } : i)) }))}
                  accessibilityLabel={`Item ${idx + 1} quantity`}
                  hint="Qty"
                />
              </View>
              <View className="flex-1">
                <Input
                  value={it.amount}
                  keyboardType="decimal-pad"
                  onChangeText={(t) => set((x) => ({ ...x, items: x.items.map((i) => (i.key === it.key ? { ...i, amount: t } : i)) }))}
                  placeholder={cur.decimals ? '0.00' : '0'}
                  accessibilityLabel={`Item ${idx + 1} price for the whole line`}
                  testID={`item-price-${idx}`}
                  hint="Line total"
                  error={errors[`amt-${it.key}`]}
                />
              </View>
              <Button
                variant="ghost"
                title="Remove"
                accessibilityLabel={`Remove item ${idx + 1}`}
                onPress={() => set((x) => ({ ...x, items: x.items.filter((i) => i.key !== it.key) }))}
              />
            </Row>
          </View>
        ))}
        <Button variant="secondary" title="Add an item" onPress={() => set((x) => ({ ...x, items: [...x.items, { key: key(), name: '', amount: '', qty: 1 }] }))} />
      </Card>

      <Card className="gap-3">
        <Text variant="h2">Tax</Text>
        <Row className="flex-wrap gap-2">
          <Chip label="No tax" selected={d.tax.mode === 'none'} onPress={() => set((x) => ({ ...x, tax: { mode: 'none' } }))} />
          <Chip label="Included in prices" selected={d.tax.mode === 'included'} onPress={() => set((x) => ({ ...x, tax: { mode: 'included' } }))} />
          {(d.currency === 'INR' ? TAX_PRESETS : []).map((p) => (
            <Chip
              key={p}
              label={`${p}%`}
              selected={d.tax.mode === 'percent' && d.tax.percent === p}
              onPress={() => set((x) => ({ ...x, tax: { mode: 'percent', percent: p, splitGst: x.tax.mode === 'percent' ? x.tax.splitGst : false } }))}
            />
          ))}
          <Chip
            label="Other rate"
            selected={d.tax.mode === 'percent' && !(d.currency === 'INR' && TAX_PRESETS.includes(d.tax.percent))}
            onPress={() => set((x) => ({ ...x, tax: { mode: 'percent', percent: '', splitGst: false } }))}
          />
          <Chip label="Amount" selected={d.tax.mode === 'fixed'} onPress={() => set((x) => ({ ...x, tax: { mode: 'fixed', amount: x.tax.mode === 'fixed' ? x.tax.amount : '' } }))} />
        </Row>
        {d.tax.mode === 'percent' && !(d.currency === 'INR' && TAX_PRESETS.includes(d.tax.percent)) ? (
          <Input
            testID="tax-rate"
            value={d.tax.percent}
            keyboardType="decimal-pad"
            onChangeText={(t) => set((x) => (x.tax.mode === 'percent' ? { ...x, tax: { ...x.tax, percent: t.replace(/[^\d.]/g, '') } } : x))}
            placeholder="8.875"
            accessibilityLabel="Tax rate in percent"
            hint="Rate in %"
            error={errors.tax}
          />
        ) : null}
        {d.tax.mode === 'fixed' ? (
          <Input
            value={d.tax.amount}
            keyboardType="decimal-pad"
            onChangeText={(t) => set((x) => ({ ...x, tax: { mode: 'fixed', amount: t } }))}
            placeholder={cur.decimals ? '0.00' : '0'}
            accessibilityLabel="Tax amount"
          />
        ) : null}
        {d.tax.mode === 'percent' && d.currency === 'INR' && taxPercent ? (
          <Chip
            label={`Show as CGST ${taxPercent / 2}% + SGST ${taxPercent / 2}%`}
            selected={d.tax.splitGst}
            onPress={() => set((x) => (x.tax.mode === 'percent' ? { ...x, tax: { ...x.tax, splitGst: !x.tax.splitGst } } : x))}
          />
        ) : null}
        <Text variant="muted">
          {d.tax.mode === 'included'
            ? 'No tax line is added, since the prices already include it.'
            : d.tax.mode === 'none'
              ? 'No tax on this bill.'
              : computed.taxTotal
                ? `${computed.tax.map((t) => `${t.label} ${money(t.amountMinor)}`).join(' + ')}${d.tax.mode === 'percent' ? ` on ${money(computed.itemsTotal)} of items` : ''}. It updates as you change items, and each person pays tax on what they ordered.`
                : 'Add items and the tax works itself out.'}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="h2">Other fees and discounts</Text>
        {d.charges.length === 0 ? <Text variant="muted">Add a delivery fee, service charge or coupon if the bill had one.</Text> : null}
        {d.charges.map((c) => (
          <View key={c.key} className="gap-2 border-b border-line pb-3 dark:border-line-dark">
            <Row className="flex-wrap gap-2">
              {CHARGE_TYPES.filter((t) => t !== 'tip').map((t) => (
                <Chip
                  key={t}
                  label={CHARGE_LABELS[t]}
                  selected={c.type === t}
                  onPress={() => set((x) => ({ ...x, charges: x.charges.map((y) => (y.key === c.key ? { ...y, type: t } : y)) }))}
                />
              ))}
            </Row>
            <Row className="gap-2">
              <View className="flex-1">
                <Input
                  value={c.label}
                  onChangeText={(t) => set((x) => ({ ...x, charges: x.charges.map((y) => (y.key === c.key ? { ...y, label: t } : y)) }))}
                  placeholder={CHARGE_LABELS[c.type]}
                  accessibilityLabel="Charge label"
                />
              </View>
              <View className="w-32">
                <Input
                  value={c.amount}
                  keyboardType="decimal-pad"
                  onChangeText={(t) => set((x) => ({ ...x, charges: x.charges.map((y) => (y.key === c.key ? { ...y, amount: t } : y)) }))}
                  accessibilityLabel={`${CHARGE_LABELS[c.type]} amount`}
                  hint={NEGATIVE_CHARGE_TYPES.includes(c.type) ? 'Taken off' : 'Added'}
                  error={errors[`amt-${c.key}`]}
                />
              </View>
            </Row>
            <Button variant="ghost" title="Remove" onPress={() => set((x) => ({ ...x, charges: x.charges.filter((y) => y.key !== c.key) }))} />
          </View>
        ))}
        <Button variant="secondary" title="Add a fee or discount" onPress={() => set((x) => ({ ...x, charges: [...x.charges, { key: key(), type: 'other', label: '', amount: '' }] }))} />
      </Card>

      <Card className="gap-3">
        <Text variant="h2">Tip</Text>
        <Row className="flex-wrap gap-2">
          <Chip label="No tip" selected={d.tip.mode === 'none'} onPress={() => set((x) => ({ ...x, tip: { mode: 'none' } }))} />
          {TIP_PRESETS.map((p) => (
            <Chip key={p} label={`${p}%`} selected={d.tip.mode === 'percent' && d.tip.percent === p} onPress={() => set((x) => ({ ...x, tip: { mode: 'percent', percent: p } }))} />
          ))}
          <Chip label="Amount" selected={d.tip.mode === 'fixed'} onPress={() => set((x) => ({ ...x, tip: { mode: 'fixed', amount: x.tip.mode === 'fixed' ? x.tip.amount : '' } }))} />
        </Row>
        {d.tip.mode === 'fixed' ? (
          <Input
            value={d.tip.amount}
            keyboardType="decimal-pad"
            onChangeText={(t) => set((x) => ({ ...x, tip: { mode: 'fixed', amount: t } }))}
            placeholder={cur.decimals ? '0.00' : '0'}
            accessibilityLabel="Tip amount"
          />
        ) : null}
        {d.tip.mode === 'percent' ? (
          <Text variant="muted">
            {d.tip.percent}% of {money(computed.itemsTotal)} is {money(computed.tip)}.
          </Text>
        ) : null}
      </Card>

      {chargeTypesPresent.length > 0 && d.splitMode === 'items' ? (
        <Card className="gap-3">
          <Text variant="h2">How each charge is shared</Text>
          <Text variant="muted">Fees are shared evenly and tax and discounts follow what each person ordered, unless you change it here.</Text>
          {chargeTypesPresent.map((t) => {
            const rule = d.feeRules[t] ?? DEFAULT_FEE_RULES[t];
            return (
              <View key={t} className="gap-1">
                <Text className="font-medium">{CHARGE_LABELS[t]}</Text>
                <Row className="flex-wrap gap-2">
                  {(['even', 'proportional', 'claims'] as FeeRule[]).map((r) => (
                    <Chip key={r} label={RULE_LABEL[r]} selected={rule === r} onPress={() => set((x) => ({ ...x, feeRules: { ...x.feeRules, [t]: r } }))} />
                  ))}
                </Row>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
