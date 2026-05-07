import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseClient } from '../lib/supabase';
import { fetchProfileById } from '../services/supabase/profiles';
import { useAppStore } from '../store/useAppStore';
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
  const setRemoteUserId = useAppStore((s) => s.setRemoteUserId);
  const syncPlayerFromRemoteProfile = useAppStore((s) => s.syncPlayerFromRemoteProfile);

  const pushProfileToStore = useCallback(
    async (userId: string) => {
      try {
        const profile = await fetchProfileById(userId);
        if (profile) {
          syncPlayerFromRemoteProfile({
            id: profile.id,
            display_name: profile.display_name,
            photo_uri: profile.photo_uri,
            position: profile.position,
            preferred_foot: profile.preferred_foot,
            iban: profile.iban,
          });
        }
      } catch (e) {
        console.warn('Supabase profile sync failed', e);
      }
    },
    [syncPlayerFromRemoteProfile],
  );

  const applySession = useCallback(
    async (sess: Session | null) => {
      setSession(sess);
      const uid = sess?.user.id ?? null;
      setRemoteUserId(uid);
      if (uid) {
        await pushProfileToStore(uid);
        try {
          await useAppStore.getState().hydrateRemoteMatches();
        } catch (e) {
          console.warn('Maç senkronu başarısız', e);
        }
      }
    },
    [pushProfileToStore, setRemoteUserId],
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
    await pushProfileToStore(uid);
  }, [configured, session?.user.id, pushProfileToStore]);

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
    await supabase.auth.signOut();
    resetSupabaseClient();
    setRemoteUserId(null);
    setSession(null);
    useAppStore.setState((state) => ({
      matches: state.matches.filter((m) => !isRemoteMatchId(m.id)),
    }));
  }, [configured, setRemoteUserId]);

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
