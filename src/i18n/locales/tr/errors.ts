import type { ErrorTranslationKey } from '../../errorTranslationKeys';

/** Turkish user-facing strings for stable error keys (Postgres + RPC ERR_*). */
export const trErrors: Record<ErrorTranslationKey, string> = {
  'errors.db.matches_max_players_chk':
    'Maç için oyuncu sayısı 4 ile 22 arasında olmalı.',
  'errors.db.matches_scores_consistency_chk':
    'Skor bilgisi tutarsız: her iki takım skoru birlikte ve sıfır veya pozitif olmalı.',
  'errors.db.matches_starts_at_upper_chk':
    'Maç başlangıç tarihi çok ileri bir tarih olarak görünüyor. Lütfen tarihi kontrol edin.',
  'errors.db.matches_payment_method_chk':
    'Ödeme yöntemi geçersiz. IBAN, nakit veya sadece not ekle seçin.',
  'errors.db.matches_payment_note_chk':
    'Sadece not ekle seçildiğinde 1-120 karakter arası not zorunludur.',
  'errors.db.profiles_display_name_len_chk':
    'Görünen ad en fazla 80 karakter olabilir.',
  'errors.db.groups_name_check': 'Grup adı en az 2 karakter olmalı.',

  'errors.rpc.authRequired': 'Bu işlem için giriş yapmanız gerekiyor.',
  'errors.rpc.forbidden': 'Bu işlem için yetkiniz bulunmuyor.',
  'errors.rpc.matchLineupLocked':
    'Kadro kilitli; takım ataması değiştirilemez.',
  'errors.rpc.groupLeaderboardForbidden':
    'Bu grubun istatistiklerini görme yetkiniz yok.',
  'errors.rpc.matchCreateGroupForbidden':
    'Bu grupta maç oluşturma yetkiniz yok.',
  'errors.rpc.matchPaymentMethodInvalid':
    'Ödeme yöntemi geçersiz. IBAN, nakit veya sadece not ekle seçin.',
  'errors.rpc.matchPaymentIbanRequired':
    'IBAN ile tahsilat için IBAN ve alıcı ad soyad zorunludur.',
  'errors.rpc.matchPaymentNoteRequired':
    'Sadece not ekle seçeneğinde ödeme notu zorunludur.',
  'errors.rpc.matchPaymentNoteTooLong':
    'Ödeme notu en fazla 120 karakter olabilir.',
  'errors.rpc.groupNameMin': 'Grup adı en az 2 karakter olmalı.',
  'errors.rpc.groupNameMax': 'Grup adı en fazla 80 karakter olabilir.',
  'errors.rpc.matchNotFound': 'Maç bulunamadı.',
  'errors.rpc.ratingCannotParticipate':
    'Bu maç için derecelendirme yapılamaz.',
  'errors.rpc.ratingFinishedOnly':
    'Derecelendirme yalnızca bitmiş maçlarda yapılabilir.',
  'errors.rpc.ratingInvalidRatee': 'Geçersiz oyuncu seçimi.',
  'errors.rpc.ratingScoreRange': 'Puan 1 ile 10 arasında olmalı.',
  'errors.rpc.ratingRateeIneligible':
    'Bu oyuncu bu maç için derecelendirilemez.',
  'errors.rpc.motmCannotVote': 'Bu maç için oy kullanamazsınız.',
  'errors.rpc.motmInvalidPick':
    'Maçın adamı için geçerli bir oyuncu seçin.',
  'errors.rpc.motmFinishedOnly':
    'Oy yalnızca bitmiş maçlarda kullanılabilir.',
  'errors.rpc.motmPlayerNotOnField':
    'Seçilen oyuncu bu maçta yer almıyor.',
};
