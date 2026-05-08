import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getEmailRedirectUrl, parseAuthCallbackUrl } from '../lib/authRedirect';
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseClient } from '../lib/supabase';
import { registerForPushToken } from '../services/notifications';
import { ensureThenFetchProfile } from '../services/supabase/profiles';
import { deactivatePushToken, upsertPushToken } from '../services/supabase/pushTokens';
import { useAppStore, useAuthStore, useGroupsStore, usePlayersStore } from '../store';
import { isRemoteMatchId } from '../utils/matchId';

export type SignUpResult = {
  error: Error | null;
  /** Sunucu kayıt sonrası JWT döndürdüyse true (çoğu kurulumda Confirm email kapalıyken). */
  sessionCreated?: boolean;
};

export type SupabaseAuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshRemoteProfile: () => Promise<void>;
  refreshAuthSession: () => Promise<void>;
  resendSignupConfirmationEmail: () => Promise<{ error: Error | null }>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

function turkishAuthCallbackErrorMessage(error_code?: string, error_description?: string): string {
  const decoded = error_description
    ? error_description.replace(/\+/g, ' ')
    : '';
  switch (error_code) {
    case 'otp_expired':
      return 'Doğrulama bağlantısının süresi doldu veya geçersiz. Lütfen yeni bir doğrulama e-postası isteyin.';
    case 'access_denied':
      return decoded.trim() || 'E-posta doğrulaması reddedildi.';
    default:
      return decoded.trim() || 'Oturum doğrulanamadı.';
  }
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const setRemoteUserId = useAuthStore((s) => s.setRemoteUserId);
  const syncPlayerFromRemoteProfile = usePlayersStore((s) => s.syncPlayerFromRemoteProfile);
  const hydrateRemoteGroups = useGroupsStore((s) => s.hydrateRemoteGroups);
  const [activePushToken, setActivePushToken] = useState<string | null>(null);
  const lastHandledAuthUrlRef = useRef<string | null>(null);

  const pushProfileToStore = useCallback(
    async (userId: string, fallbackEmail?: string | null, meta?: User['user_metadata']) => {
      if (!configured) return;
      const metaDisplay =
        (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta?.display_name === 'string' && meta.display_name.trim()) ||
        '';
      const stub = () =>
        syncPlayerFromRemoteProfile({
          id: userId,
          display_name: metaDisplay || fallbackEmail?.split('@')[0]?.trim() || 'Oyuncu',
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
        await pushProfileToStore(uid, sess?.user.email ?? null, sess?.user.user_metadata);
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

  const handleAuthDeepLink = useCallback(
    async (url: string | null) => {
      if (!configured || !url) return;
      const parsed = parseAuthCallbackUrl(url);
      if (!parsed) return;
      if (lastHandledAuthUrlRef.current === url) return;
      lastHandledAuthUrlRef.current = url;

      const supabase = getSupabaseClient();

      if (parsed.kind === 'error') {
        Alert.alert(
          'Doğrulama',
          turkishAuthCallbackErrorMessage(parsed.error_code, parsed.error_description),
        );
        return;
      }

      if (parsed.kind === 'pkce') {
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (error) {
          Alert.alert('Doğrulama', error.message);
        }
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });
      if (error) {
        Alert.alert('Oturum', error.message);
      }
    },
    [configured],
  );

  useEffect(() => {
    if (!configured) return;

    void Linking.getInitialURL().then((url) => void handleAuthDeepLink(url));

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleAuthDeepLink(url);
    });

    return () => sub.remove();
  }, [configured, handleAuthDeepLink]);

  const refreshRemoteProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!configured || !uid) return;
    await pushProfileToStore(uid, session?.user.email ?? null, session?.user.user_metadata);
  }, [configured, session?.user.email, session?.user.id, session?.user.user_metadata, pushProfileToStore]);

  const refreshAuthSession = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('Oturum yenilenemedi', error.message);
      return;
    }
    if (data.session) {
      await applySession(data.session);
    }
  }, [configured, applySession]);

  const resendSignupConfirmationEmail = useCallback(async () => {
    if (!configured) return { error: new Error('Supabase yapılandırılmadı') };
    const email = session?.user?.email?.trim();
    if (!email) return { error: new Error('E-posta bulunamadı') };
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getEmailRedirectUrl() },
    });
    return { error: error ? new Error(error.message) : null };
  }, [configured, session?.user?.email]);

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
    async (email: string, password: string, displayName: string): Promise<SignUpResult> => {
      if (!configured) return { error: new Error('Supabase yapılandırılmadı') };
      const trimmedName = displayName.trim();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
          data: {
            full_name: trimmedName,
            display_name: trimmedName,
          },
        },
      });
      if (error) return { error: new Error(error.message), sessionCreated: false };
      return {
        error: null,
        sessionCreated: Boolean(data.session),
      };
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
      refreshAuthSession,
      resendSignupConfirmationEmail,
    }),
    [
      configured,
      loading,
      session,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshRemoteProfile,
      refreshAuthSession,
      resendSignupConfirmationEmail,
    ],
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error('useSupabaseAuth yalnızca SupabaseAuthProvider içinde kullanılmalıdır.');
  return ctx;
}
