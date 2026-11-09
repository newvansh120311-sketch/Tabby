import { requireOptionalNativeModule } from 'expo-modules-core';
import type { OcrLine } from '@tabby/core';

interface TabbyNativeModule {
  recognizeText(uri: string): Promise<{ text: string; lines: OcrLine[] }>;
  isInstalled(packageName: string): boolean;
  launchApp(packageName: string): boolean;
  getReferrerPackage(): string | null;
  hasUpiApp(): boolean;
}

// Optional so the JS bundle still loads in tools that don't have the native side (tests, web).
const native = requireOptionalNativeModule<TabbyNativeModule>('TabbyNative');

export const TabbyNative = {
  available: !!native,
  recognizeText: (uri: string) =>
    native ? native.recognizeText(uri) : Promise.reject(new Error('Text recognition needs the Android app')),
  isInstalled: (pkg: string) => native?.isInstalled(pkg) ?? false,
  launchApp: (pkg: string) => native?.launchApp(pkg) ?? false,
  getReferrerPackage: () => native?.getReferrerPackage() ?? null,
  hasUpiApp: () => native?.hasUpiApp() ?? true,
};
