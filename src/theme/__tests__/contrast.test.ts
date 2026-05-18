import { darkColors, lightColors } from '../index';

/**
 * WebAIM / WCAG 2.1 göreceli parlaklık (relative luminance) hesabı.
 *
 * Yalnızca düz `#RRGGBB` formatını destekler — `rgba()` veya 3 karakterli kısa
 * formatlar bilinçli olarak hesaba alınmaz (alfa kanalı kontrast oranı için
 * tanımsızdır; semi-transparent yüzeyler için ayrı bir testin yazılması gerekir).
 */
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || m[1] === undefined) {
    throw new Error(`relativeLuminance: hex '${hex}' formatı desteklenmiyor`);
  }
  const value = m[1];
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrastRatio(a: string, b: string): number {
  const sorted = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  const hi = sorted[0]!;
  const lo = sorted[1]!;
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;
const AAA_NORMAL = 7.0;

describe('Tema rengi WCAG kontrast guard', () => {
  describe('karanlık tema', () => {
    it('text vs background AAA (>= 7.0) olmalı', () => {
      expect(contrastRatio(darkColors.text, darkColors.background)).toBeGreaterThanOrEqual(
        AAA_NORMAL,
      );
    });

    it('textMuted vs background AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(darkColors.textMuted, darkColors.background)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('textMuted vs surface AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(darkColors.textMuted, darkColors.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('textMuted vs surfaceSoft AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(darkColors.textMuted, darkColors.surfaceSoft)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('textOnAccent vs accent (dolgu üstü metin) AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(darkColors.textOnAccent, darkColors.accent)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });
  });

  describe('aydınlık tema', () => {
    it('textMuted vs background AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(lightColors.textMuted, lightColors.background)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('textMuted vs surface AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(lightColors.textMuted, lightColors.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('textMuted vs surfaceSoft AA (>= 4.5) olmalı — opaque liste yüzeyleri için kritik', () => {
      expect(contrastRatio(lightColors.textMuted, lightColors.surfaceSoft)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('textOnAccent vs accent AA (>= 4.5) olmalı', () => {
      expect(contrastRatio(lightColors.textOnAccent, lightColors.accent)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });
  });

  /**
   * Toast aksiyon butonu metni Toast yüzeyi (`surface`) üzerinde variant rengini kullanır.
   * `ToastHost`: success/warning/error/info → accent/indigo/danger/slate.
   * Aksiyon küçük metindir (typography.caption, 13px non-bold) — AA için 4.5 gerekir.
   */
  describe('Toast aksiyon metni kontrastı', () => {
    const variants = [
      { name: 'success → accent', darkFg: darkColors.accent, lightFg: lightColors.accent },
      { name: 'warning → indigo', darkFg: darkColors.indigo, lightFg: lightColors.indigo },
      { name: 'error → danger', darkFg: darkColors.danger, lightFg: lightColors.danger },
      { name: 'info → slate', darkFg: darkColors.slate, lightFg: lightColors.slate },
    ] as const;

    for (const { name, darkFg, lightFg } of variants) {
      it(`${name} (karanlık) vs surface AA (>= 4.5) olmalı`, () => {
        expect(contrastRatio(darkFg, darkColors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it(`${name} (aydınlık) vs surface AA (>= 4.5) olmalı`, () => {
        expect(contrastRatio(lightFg, lightColors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  });
});
