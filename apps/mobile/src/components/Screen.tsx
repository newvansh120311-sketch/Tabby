import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useOutbox } from '@/lib/outbox';
import { Text } from './ui';

/** Page wrapper: safe area, scrolling, pull to refresh, and a centred max width on tablets. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  footer,
  scroll = true,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const { c } = useTheme();
  const body = <View className="w-full max-w-2xl gap-4 self-center px-4 pb-8 pt-2">{children}</View>;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-bg dark:bg-bg-dark">
      <SyncBanner />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} /> : undefined}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? (
          <View className="border-t border-line bg-surface px-4 py-3 dark:border-line-dark dark:bg-surface-dark">
            <View className="w-full max-w-2xl self-center">{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SyncBanner() {
  const { count, syncing } = useOutbox();
  if (!count) return null;
  return (
    <View className="bg-warnsoft px-4 py-1.5 dark:bg-warnsoft-dark" accessibilityLiveRegion="polite">
      <Text variant="small" className="text-center text-warn dark:text-warn-dark">
        {syncing ? 'Syncing your changes…' : `${count} change${count === 1 ? '' : 's'} waiting to sync. They’ll send when you’re back online.`}
      </Text>
    </View>
  );
}
