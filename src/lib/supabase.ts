import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const secureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
