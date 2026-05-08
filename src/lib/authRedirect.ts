import * as Linking from 'expo-linking';

/**
 * Supabase e-posta doğrulaması: `getEmailRedirectUrl()` çıktısını hosting projenizde
 * Authentication → URL Configuration → Redirect URLs listesine ekleyin (yerel `supabase/config.toml` ile uyumlu tutun).
 * Expo Go geliştirmede çıkan `exp://…/--/auth/callback` adresi makineye özeldir; bir kez konsoldan/logdan kopyalayıp Dashboard’a ekleyin.
 */

/** Must match Supabase redirect allow list (and local config.toml if used). */
export const AUTH_CALLBACK_PATH = 'auth/callback';

/** Redirect URL for email confirmation / magic-link flows (stable scheme in dev builds and production). */
export function getEmailRedirectUrl(): string {
  // Same string must be listed in Supabase Dashboard → Redirect URLs. Most dashboards reject
  // `halisaha:///…` (triple slash); `halisaha://auth/callback` is the usual accepted form.
  return Linking.createURL(AUTH_CALLBACK_PATH, { scheme: 'halisaha' });
}

export type ParsedAuthCallback =
  | { kind: 'session'; access_token: string; refresh_token: string }
  | { kind: 'pkce'; code: string }
  | { kind: 'error'; error: string; error_code?: string; error_description?: string };

function parseHashParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(hashIndex + 1)));
}

/** Recognizes Expo Go (`exp://…/--/auth/callback`), triple-slash (`halisaha:///auth/callback`), and two-slash (`halisaha://auth/callback`) forms. */
export function isAuthEmailCallbackUrl(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? '').replace(/^\/+/, '');
    if (path === AUTH_CALLBACK_PATH) return true;
    if (path.endsWith(`/${AUTH_CALLBACK_PATH}`) || path.endsWith(AUTH_CALLBACK_PATH)) return true;
  } catch {
    /* fall through */
  }
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/^\/+|\/+$/g, '');
    if (u.hostname && p) {
      const combined = `${u.hostname}/${p}`;
      return combined === AUTH_CALLBACK_PATH;
    }
    return p === AUTH_CALLBACK_PATH;
  } catch {
    return url.includes(AUTH_CALLBACK_PATH);
  }
}

export function parseAuthCallbackUrl(url: string): ParsedAuthCallback | null {
  if (!isAuthEmailCallbackUrl(url)) return null;

  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(url).searchParams;
  } catch {
    searchParams = new URLSearchParams();
  }

  const code = searchParams.get('code');
  if (code) {
    return { kind: 'pkce', code };
  }

  const hashParams = parseHashParams(url);
  if (hashParams.error || hashParams.error_code || hashParams.error_description) {
    return {
      kind: 'error',
      error: hashParams.error ?? 'access_denied',
      error_code: hashParams.error_code,
      error_description: hashParams.error_description,
    };
  }

  const access_token = hashParams.access_token;
  const refresh_token = hashParams.refresh_token;
  if (access_token && refresh_token) {
    return { kind: 'session', access_token, refresh_token };
  }

  return null;
}
