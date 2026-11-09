import type { ConfigContext, ExpoConfig } from 'expo/config';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tabby-split-amber.vercel.app';
const HOST = new URL(API_URL).host;
const PROJECT_ID = '461a0fc8-4e23-4656-8b00-3945b21500e4';

// Delivery and booking apps we offer "Open in…" shortcuts for. Android 11+ needs them
// declared before we can check whether they're installed.
export const PLATFORM_PACKAGES = [
  'in.swiggy.android',
  'com.application.zomato',
  'com.zeptoconsumerapp',
  'com.grofers.customerapp',
  'com.application.zomato.district',
  'com.eazydiner',
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tabby',
  slug: 'tabby',
  owner: 'vans_lords',
  scheme: 'tabby',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: `https://u.expo.dev/${PROJECT_ID}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  android: {
    package: 'app.tabby.split',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-mono.png',
      backgroundColor: '#E2603A',
    },
    permissions: ['android.permission.CAMERA', 'android.permission.INTERNET'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: HOST, pathPrefix: '/b/' },
          { scheme: 'https', host: HOST, pathPrefix: '/t/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#FAF7F2',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#16130F' },
      },
    ],
    ['expo-camera', { cameraPermission: 'Tabby uses the camera to read receipts.', recordAudioAndroid: false }],
    ['expo-image-picker', { photosPermission: 'Tabby reads receipt photos you pick.' }],
    [
      'expo-share-intent',
      {
        androidIntentFilters: ['text/*', 'image/*'],
        androidMultiIntentFilters: [],
        disableIOS: true,
      },
    ],
    '@react-native-google-signin/google-signin',
    ['expo-build-properties', { android: { minSdkVersion: 29, targetSdkVersion: 36, buildArchs: ['armeabi-v7a', 'arm64-v8a', 'x86_64'] } }],
    ['./plugins/withPackageQueries', { packages: PLATFORM_PACKAGES, schemes: ['upi'] }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: API_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    eas: { projectId: PROJECT_ID },
    router: { origin: false },
  },
});
