import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321').trim();
const anonKey = (process.env.SUPABASE_ANON_KEY ?? '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

export const integrationEnv = {
  url,
  anonKey,
  serviceRoleKey,
  ready: Boolean(url && anonKey && serviceRoleKey),
};

export function requireIntegrationEnv(): void {
  if (!integrationEnv.ready) {
    throw new Error(
      'RLS integration tests need SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (e.g. from `supabase status`).',
    );
  }
}

export function createAnonClient(): SupabaseClient {
  requireIntegrationEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createServiceRoleClient(): SupabaseClient {
  requireIntegrationEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type AuthedTestUser = {
  client: SupabaseClient;
  userId: string;
  email: string;
  password: string;
};

export async function createAuthedUser(label: string): Promise<AuthedTestUser> {
  requireIntegrationEnv();
  const admin = createServiceRoleClient();
  const email = `rls_${label}_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`;
  const password = 'TestPass123!';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('createUser returned no user');

  const client = createAnonClient();
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;

  return { client, userId: user.id, email, password };
}

export const describeIntegration = integrationEnv.ready ? describe : describe.skip;
