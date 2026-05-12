import Constants from 'expo-constants';

/** İnsan tarafından okunabilir uygulama sürümü (native derleme varsa ek bilgi). */
export function getAppVersionLabel(): string {
  const expoVersion = typeof Constants.expoConfig?.version === 'string' ? Constants.expoConfig.version.trim() : undefined;
  const native = typeof Constants.nativeApplicationVersion === 'string' ? Constants.nativeApplicationVersion.trim() : undefined;
  const build = typeof Constants.nativeBuildVersion === 'string' ? Constants.nativeBuildVersion.trim() : undefined;

  const primary = native ?? expoVersion ?? '—';
  if (build && build !== native) {
    return `${primary} (${build})`;
  }
  return primary;
}

/** Ayarlar / Hakkında için kısa meta satırı. */
export function getAppVersionDetailLines(): string[] {
  const lines: string[] = [];
  const expoVersion = typeof Constants.expoConfig?.version === 'string' ? Constants.expoConfig.version.trim() : undefined;
  if (expoVersion) lines.push(`Yapılandırma sürümü: ${expoVersion}`);
  const native = typeof Constants.nativeApplicationVersion === 'string' ? Constants.nativeApplicationVersion.trim() : undefined;
  if (native) lines.push(`Yerel sürüm: ${native}`);
  const build = typeof Constants.nativeBuildVersion === 'string' ? Constants.nativeBuildVersion.trim() : undefined;
  if (build) lines.push(`Derleme: ${build}`);
  return lines;
}
