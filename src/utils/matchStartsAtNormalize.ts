/**
 * Maç başlangıç zamanı: yarım saat grid ve geçmişe düşmeyi engelleme.
 * CreateMatchTabScreen ile aynı kurallar (tek kaynak).
 */

/** Seçilen zamanı en yakın tam / buçuk saate (:00 veya :30) yuvarlar. */
export function snapStartsAtToNearestHalfHour(d: Date): Date {
  const x = new Date(d);
  const minutes = x.getMinutes();
  if (minutes < 15) {
    x.setMinutes(0, 0, 0);
  } else if (minutes < 45) {
    x.setMinutes(30, 0, 0);
  } else {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  }
  return x;
}

/** Geçerli andan sonraki tam veya buçuk saat (dakika/saniye sıfırlanmış). */
export function roundUpToNextHalfHour(d: Date): Date {
  const x = new Date(d);
  const mins = x.getMinutes();
  const secs = x.getSeconds();
  const ms = x.getMilliseconds();
  if (secs === 0 && ms === 0 && (mins === 0 || mins === 30)) {
    return x;
  }
  if (mins < 30) {
    x.setMinutes(30, 0, 0);
  } else {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  }
  return x;
}

/** Picker çıktısı: yarım saat grid + geçmişte kalmışsa şu andan sonraki uygun slot. */
export function normalizeStartsAtFromPicker(d: Date): Date {
  const snapped = snapStartsAtToNearestHalfHour(d);
  const t = Date.now();
  if (snapped.getTime() >= t) {
    return snapped;
  }
  return roundUpToNextHalfHour(new Date(t));
}
