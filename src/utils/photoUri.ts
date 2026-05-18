/**
 * Supabase Storage public URL'leri sabit yol + upsert ile aynı kalır; HTTP önbelleği eski görseli tutabilir.
 * Sürüm anahtarı (genelde `profiles.updated_at`) ile `v=` eklenir — query string değiştiğinde CDN/expo-image
 * için yeni URL → cache miss → fresh görsel. Veritabanında yalnızca sorgusuz URL saklanır.
 *
 * Storage tarafı tamamlayıcı kontrat: `avatarUpload.ts` upload sırasında uzun
 * `cacheControl: '31536000'` (1 yıl) verir. Versiyon değişmedikçe CDN edge ve
 * `expo-image` memory-disk cache rahatlıkla hit verir.
 */
export function appendPhotoUriCacheBuster(
  uri: string | null | undefined,
  version: string | number | undefined,
): string | undefined {
  const base = uri?.trim();
  if (!base) return undefined;
  if (version === undefined || version === '') {
    return stripUrlQueryForStorage(base);
  }
  const clean = stripUrlQueryForStorage(base);
  const v = String(version);
  const sep = clean.includes('?') ? '&' : '?';
  return `${clean}${sep}v=${encodeURIComponent(v)}`;
}

/** Profil / depolama için: sorgu dizesini kaldır (önb. anahtarını yalnızca istemcide tut). */
export function stripUrlQueryForStorage(uri: string): string {
  const t = uri.trim();
  const q = t.indexOf('?');
  if (q === -1) return t;
  return t.slice(0, q);
}
