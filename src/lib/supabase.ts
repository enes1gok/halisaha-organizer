import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// SecureStore has a 2048-byte limit per key. Supabase session tokens exceed this.
// Split large values into chunks and reassemble on read.
const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = '__chunkCount';

const secureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countRaw !== null) {
      const count = parseInt(countRaw, 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__chunk${i}`);
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join('');
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}__chunk${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(chunks.length));
    // Remove legacy non-chunked entry if it existed
    await SecureStore.deleteItemAsync(key);
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countRaw !== null) {
      const count = parseInt(countRaw, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk${i}`);
      }
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | null = null;

export function readSupabaseConfig(): { url: string; anonKey: string } {
  const extra = Constants.expoConfig?.extra as
    | { supabaseUrl?: string; supabaseAnonKey?: string }
    | undefined;
  const url = (extra?.supabaseUrl ?? '').trim();
  const anonKey = (extra?.supabaseAnonKey ?? '').trim();
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readSupabaseConfig();
  return Boolean(url && anonKey);
}

/** Fresh client (throws if env missing). Prefer {@link getSupabaseClient} for a singleton. */
export function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = readSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error(
      'Supabase yapılandırması eksik: EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ortam değişkenlerini ayarlayın.',
    );
  }
  return createClient(url, anonKey, {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!client) client = createSupabaseClient();
  return client;
}

/** Örn. çıkış sonrası yeni anon oturumu için. */
export function resetSupabaseClient(): void {
  client = null;
}
