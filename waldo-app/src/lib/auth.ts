import * as SecureStore from 'expo-secure-store';
import { resetToDefaultUser } from './supabase';

let _onLogout: (() => void) | null = null;

export function registerLogoutHandler(fn: () => void): void {
  _onLogout = fn;
}

export async function logout(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync('waldo_user_id'),
    SecureStore.deleteItemAsync('waldo_user_name'),
    SecureStore.deleteItemAsync('waldo_onboarding_done'),
    SecureStore.deleteItemAsync('waldo_linking_code'),
  ]);
  resetToDefaultUser();
  _onLogout?.();
}
