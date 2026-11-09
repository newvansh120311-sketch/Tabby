import { ActivityIndicator, Pressable, Text as RNText, TextInput, View, type PressableProps, type TextInputProps, type TextProps, type ViewProps } from 'react-native';
import { forwardRef } from 'react';
import { useTheme } from '@/lib/theme';
import type { PayStatus } from '@/lib/types';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Text({ className, variant = 'body', ...p }: TextProps & { className?: string; variant?: 'title' | 'h2' | 'body' | 'muted' | 'small' | 'money' }) {
  const v = {
    title: 'text-2xl font-bold text-ink dark:text-ink-dark',
    h2: 'text-lg font-semibold text-ink dark:text-ink-dark',
    body: 'text-base text-ink dark:text-ink-dark',
    muted: 'text-sm text-muted dark:text-muted-dark',
    small: 'text-xs text-muted dark:text-muted-dark',
    money: 'text-base font-semibold text-ink dark:text-ink-dark',
  }[variant];
  return <RNText {...p} className={cx(v, className)} style={[variant === 'money' ? { fontVariant: ['tabular-nums'] } : null, p.style]} />;
}

export function Card({ className, ...p }: ViewProps & { className?: string }) {
  return <View {...p} className={cx('rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark', className)} />;
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  title,
  variant = 'primary',
  loading,
  icon,
  className,
  disabled,
  ...p
}: PressableProps & { title: string; variant?: BtnVariant; loading?: boolean; icon?: string; className?: string }) {
  const { c } = useTheme();
  const box = {
    primary: 'bg-brand dark:bg-brand-dark',
    secondary: 'border border-line bg-surface dark:border-line-dark dark:bg-surface-dark',
    ghost: '',
    danger: 'border border-danger dark:border-danger-dark',
  }[variant];
  const txt = {
    primary: 'text-white dark:text-[#1a0d07]',
    secondary: 'text-ink dark:text-ink-dark',
    ghost: 'text-brand dark:text-brand-dark',
    danger: 'text-danger dark:text-danger-dark',
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      {...p}
      className={cx('min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 active:opacity-80', box, (disabled || loading) && 'opacity-50', className)}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? c.brandInk : c.brand} /> : null}
      {icon ? <RNText className={cx('text-base', txt)}>{icon}</RNText> : null}
      <RNText className={cx('text-base font-semibold', txt)}>{title}</RNText>
    </Pressable>
  );
}

export const Input = forwardRef<React.ElementRef<typeof TextInput>, TextInputProps & { className?: string; label?: string; error?: string | null; hint?: string }>(
  function Input({ className, label, error, hint, ...p }, ref) {
    const { c } = useTheme();
    return (
      <View className="gap-1">
        {label ? <Text variant="muted">{label}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.muted}
          accessibilityLabel={p.accessibilityLabel ?? label}
          {...p}
          className={cx(
            'min-h-12 rounded-xl border bg-bg px-3 text-base text-ink dark:bg-bg-dark dark:text-ink-dark',
            error ? 'border-danger dark:border-danger-dark' : 'border-line dark:border-line-dark',
            className,
          )}
        />
        {error ? <Text className="text-danger dark:text-danger-dark" variant="small">{error}</Text> : hint ? <Text variant="small">{hint}</Text> : null}
      </View>
    );
  },
);

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'warn' | 'brand' }) {
  const t = {
    neutral: ['bg-surface2 dark:bg-surface2-dark', 'text-muted dark:text-muted-dark'],
    ok: ['bg-oksoft dark:bg-oksoft-dark', 'text-ok dark:text-ok-dark'],
    warn: ['bg-warnsoft dark:bg-warnsoft-dark', 'text-warn dark:text-warn-dark'],
    brand: ['bg-brandsoft dark:bg-brandsoft-dark', 'text-brand dark:text-brand-dark'],
  }[tone];
  return (
    <View className={cx('self-start rounded-full px-2.5 py-0.5', t[0])}>
      <RNText className={cx('text-xs font-medium', t[1])}>{label}</RNText>
    </View>
  );
}

export function StatusPill({ status }: { status: PayStatus | null }) {
  if (!status) return null;
  if (status === 'confirmed') return <Badge tone="ok" label="Confirmed" />;
  if (status === 'marked') return <Badge tone="warn" label="Marked paid" />;
  return <Badge label="Unpaid" />;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-3" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="h-14 rounded-xl bg-surface2 opacity-70 dark:bg-surface2-dark" />
      ))}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <View className="items-center gap-2 px-6 py-10">
      <Text variant="h2" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="text-center">
        {body}
      </Text>
      {action ? <View className="mt-3 w-full max-w-xs">{action}</View> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="gap-2 border-danger dark:border-danger-dark">
      <Text className="text-danger dark:text-danger-dark">{message}</Text>
      {onRetry ? <Button variant="secondary" title="Try again" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Row({ className, ...p }: ViewProps & { className?: string }) {
  return <View {...p} className={cx('flex-row items-center', className)} />;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cx(
        'min-h-10 justify-center rounded-full border px-3',
        selected ? 'border-brand bg-brandsoft dark:border-brand-dark dark:bg-brandsoft-dark' : 'border-line dark:border-line-dark',
      )}
    >
      <RNText className={cx('text-sm', selected ? 'font-semibold text-brand dark:text-brand-dark' : 'text-ink dark:text-ink-dark')}>{label}</RNText>
    </Pressable>
  );
}
