import { formatMoney } from '@tabby/core';
import { Text } from './ui';

export function Money({ minor, currency, className, signed }: { minor: number; currency: string; className?: string; signed?: boolean }) {
  return (
    <Text variant="money" className={className}>
      {formatMoney(minor, currency, { signed })}
    </Text>
  );
}
