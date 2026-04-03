/**
 * Encryption key management for the local SQLite database.
 *
 * The key is a 32-byte random value stored in the iOS Keychain via
 * expo-secure-store. This ensures:
 * - Key survives app updates (Keychain is preserved)
 * - Key is lost on fresh install / device restore (intentional — health
 *   data is synced to Supabase, local DB is a cache)
 * - Key is hardware-bound on devices with Secure Enclave
 *
 * Security: Never log, print, or include the key in error messages.
 */

import * as SecureStore from 'expo-secure-store';

const KEY_STORE_KEY = 'waldo_db_encryption_key_v1';

/** Byte length for AES-256 (32 bytes = 256 bits) */
const KEY_BYTES = 32;

/** Generate a cryptographically random key as a hex string */
function generateKey(): string {
  const bytes = new Uint8Array(KEY_BYTES);
  // React Native's global crypto is available on RN 0.74+
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Retrieve the DB encryption key from Keychain.
 * Creates and stores a new key on first call.
 *
 * @throws If Keychain access fails (device locked, permission denied)
 */
export async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_STORE_KEY);
  if (existing) {
    return existing;
  }

  const newKey = generateKey();
  await SecureStore.setItemAsync(KEY_STORE_KEY, newKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return newKey;
}

/**
 * Check if a DB key exists without creating one.
 * Used to detect first-run state.
 */
export async function hasDbKey(): Promise<boolean> {
  const existing = await SecureStore.getItemAsync(KEY_STORE_KEY);
  return existing !== null;
}

/**
 * Delete the stored key (used when DB is corrupted and needs recreation).
 * DESTRUCTIVE: After calling this, the old DB cannot be decrypted.
 */
export async function deleteDbKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_STORE_KEY);
}
