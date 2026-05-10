import Constants from 'expo-constants';

/** İnsan tarafından okunabilir uygulama sürümü (native derleme varsa ek bilgi). */
export function getAppVersionLabel(): string {
  const expoVersion = Constants.expoConfig?.version?.trim();
  const native = Constants.nativeApplicationVersion?.trim();
  const build = Constants.nativeBuildVersion?.trim();

  const primary = native ?? expoVersion ?? '—';
  if (build && build !== native) {
    return `${primary} (${build})`;
  }
  return primary;
}

/** Ayarlar / Hakkında için kısa meta satırı. */
export function getAppVersionDetailLines(): string[] {
  const lines: string[] = [];
  const expoVersion = Constants.expoConfig?.version?.trim();
  if (expoVersion) lines.push(`Yapılandırma sürümü: ${expoVersion}`);
  const native = Constants.nativeApplicationVersion?.trim();
  if (native) lines.push(`Yerel sürüm: ${native}`);
  const build = Constants.nativeBuildVersion?.trim();
  if (build) lines.push(`Derleme: ${build}`);
  return lines;
}
