import Constants from 'expo-constants';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { api } from './api';
import { queryClient } from './queries';
import { authToken } from './storage';
import type { Me } from './types';

const WEB_CLIENT_ID = (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ?? '';

/** False when the build has no Google client ID; the app then runs on the device token alone. */
export const googleConfigured = /\.apps\.googleusercontent\.com$/.test(WEB_CLIENT_ID);

let configured = false;
export function configureGoogle() {
  if (!googleConfigured || configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
  configured = true;
}

export async function signInWithGoogle(): Promise<Me | null> {
  configureGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null; // cancelled
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('Google didn’t return a sign-in token. Try again.');
    const { token, me } = await api<{ token: string; me: Me }>('/api/mobile/google', { method: 'POST', json: { idToken } });
    authToken.set(token);
    await queryClient.invalidateQueries();
    return me;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return null;
    throw e;
  }
}

export async function signOut() {
  authToken.set(null);
  if (googleConfigured) await GoogleSignin.signOut().catch(() => undefined);
  await queryClient.invalidateQueries();
}
