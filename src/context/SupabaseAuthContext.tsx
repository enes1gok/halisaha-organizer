import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseClient } from '../lib/supabase';
import { registerForPushToken } from '../services/notifications';
import { ensureThenFetchProfile } from '../services/supabase/profiles';
import { deactivatePushToken, upsertPushToken } from '../services/supabase/pushTokens';
import { useAppStore, useAuthStore, useGroupsStore, usePlayersStore } from '../store';
import { isRemoteMatchId } from '../utils/matchId';

export type SupabaseAuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRemoteProfile: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const setRemoteUserId = useAuthStore((s) => s.setRemoteUserId);
  const syncPlayerFromRemoteProfile = usePlayersStore((s) => s.syncPlayerFromRemoteProfile);
  const hydrateRemoteGroups = useGroupsStore((s) => s.hydrateRemoteGroups);
  const [activePushToken, setActivePushToken] = useState<string | null>(null);

  const pushProfileToStore = useCallback(
    async (userId: string, fallbackEmail?: string | null) => {
      if (!configured) return;
      const stub = () =>
        syncPlayerFromRemoteProfile({
          id: userId,
          display_name: fallbackEmail?.split('@')[0]?.trim() || 'Oyuncu',
          photo_uri: null,
          position: 'MID',
          preferred_foot: 'both',
          iban: null,
        });
      try {
        const profile = await ensureThenFetchProfile(userId);
        if (profile) {
          syncPlayerFromRemoteProfile({
            id: profile.id,
            display_name: profile.display_name,
            photo_uri: profile.photo_uri,
            position: profile.position,
            preferred_foot: profile.preferred_foot,
            iban: profile.iban,
          });
        } else {
          stub();
        }
      } catch (e) {
        console.warn('Supabase profile sync failed', e);
        stub();
      }
    },
    [configured, syncPlayerFromRemoteProfile],
  );

  const applySession = useCallback(
    async (sess: Session | null) => {
      setSession(sess);
      const uid = sess?.user.id ?? null;
      setRemoteUserId(uid);
      if (uid) {
        await pushProfileToStore(uid, sess?.user.email ?? null);
        try {
          await Promise.all([useAppStore.getState().hydrateRemoteMatches(), hydrateRemoteGroups()]);
        } catch (e) {
          console.warn('Maç senkronu başarısız', e);
        }
        try {
          const token = await registerForPushToken();
          if (token) {
            await upsertPushToken(token, 'expo');
            setActivePushToken(token);
          }
        } catch (e) {
          console.warn('Push token kaydı başarısız', e);
        }
      }
    },
    [hydrateRemoteGroups, pushProfileToStore, setRemoteUserId],
  );

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = getSupabaseClient();

    void supabase.auth
      .getSession()
      .then(({ data: { session: initial } }) => {
        if (cancelled) return;
        void applySession(initial).finally(() => {
          if (!cancelled) setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured, applySession]);

  const refreshRemoteProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!configured || !uid) return;
    await pushProfileToStore(uid, session?.user.email ?? null);
  }, [configured, session?.user.email, session?.user.id, pushProfileToStore]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!configured) return { error: new Error('Supabase yapılandırılmadı') };
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error ? new Error(error.message) : null };
    },
    [configured],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!configured) return { error: new Error('Supabase yapılandırılmadı') };
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      return { error: error ? new Error(error.message) : null };
    },
    [configured],
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabaseClient();
    if (activePushToken) {
      try {
        await deactivatePushToken(activePushToken);
      } catch (e) {
        console.warn('Push token pasifleştirme başarısız', e);
      }
    }
    await supabase.auth.signOut();
    resetSupabaseClient();
    setRemoteUserId(null);
    setSession(null);
    setActivePushToken(null);
    useAppStore.setState((state) => ({
      matches: state.matches.filter((m) => !isRemoteMatchId(m.id)),
      groups: [],
      groupMemberships: [],
    }));
  }, [activePushToken, configured, setRemoteUserId]);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      configured,
      loading,
      session,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshRemoteProfile,
    }),
    [
      configured,
      loading,
      session,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshRemoteProfile,
    ],
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error('useSupabaseAuth yalnızca SupabaseAuthProvider içinde kullanılmalıdır.');
  return ctx;
}
