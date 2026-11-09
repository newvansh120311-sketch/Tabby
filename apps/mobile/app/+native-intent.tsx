import { getShareExtensionKey } from 'expo-share-intent';

// expo-share-intent delivers shares as a tabby://dataUrl=… link. Send those to the share screen
// instead of letting the router look for a matching page, on both cold and warm starts.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/share';
    return path;
  } catch {
    return '/';
  }
}
