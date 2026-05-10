import { useWindowDimensions } from 'react-native';

/**
 * Sistem yazı boyutu çarpanını ve adaptif layout için ortak eşikleri döner.
 *
 * Eşik değerleri tek kaynak olarak burada tanımlanır; ekran/bileşen düzeyinde
 * "şu kadarın üstünde dikey listeye geç" gibi kararlar bu hook üzerinden alınmalı
 * ki tüm ekranlar aynı eşikte tetiklensin.
 *
 * Notlar:
 *  - `App.tsx`'te `Text.defaultProps.maxFontSizeMultiplier = 1.6` ile global tavan
 *    konulduğu için pratikte `fontScale` 1.6'yı geçtiğinde de metin daha fazla
 *    büyümez; ancak `useWindowDimensions().fontScale` kullanıcının sistem ayarını
 *    aynen yansıttığı için layout kararları için **gerçek** ölçeği kullanırız.
 *  - `isLarge` (>= 1.3) küçük ipuçları/etiketleri sadeleştirmek için kullanılır.
 *  - `isHuge` (>= 1.5) yatay düzenleri dikeye çevirmek gibi yapısal değişiklikler için.
 */
export function useFontScale(): {
  fontScale: number;
  isLarge: boolean;
  isHuge: boolean;
} {
  const { fontScale } = useWindowDimensions();
  return {
    fontScale,
    isLarge: fontScale >= 1.3,
    isHuge: fontScale >= 1.5,
  };
}
