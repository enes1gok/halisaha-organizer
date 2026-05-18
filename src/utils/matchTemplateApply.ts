import {
  MATCH_TEMPLATE_NAME_MAX_LEN,
  type MatchPaymentMethod,
  type MatchTemplate,
} from '../types/domain';
import { isValidTurkishIban } from './iban';
import { clampEvenMatchMaxPlayers } from './matchMaxPlayers';
import { normalizeStartsAtFromPicker } from './matchStartsAtNormalize';

/** JavaScript `Date#getDay()` → ISO weekday (1 = Pazartesi … 7 = Pazar). */
export function jsDayToIsoDow(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** ISO weekday → JS Sunday-based day of week. */
export function isoDowToJsDay(isoDow: number): number {
  return isoDow === 7 ? 0 : isoDow;
}

export type ParsedLocalTime = { hour: number; minute: number };

/** `HH:mm` veya `HH:mm:ss` (yerel). */
export function parseMatchTemplateLocalTime(localTime: string): ParsedLocalTime | null {
  const t = localTime.trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatLocalTimeFromDate(d: Date): string {
  const h = d.getHours();
  const min = d.getMinutes();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(min)}:00`;
}

/**
 * Bir sonraki gelecek an: verilen ISO hafta günü ve yerel saatte,
 * `now`'dan strictly sonra ilk zaman damgası.
 */
export function computeNextStartsAtForSchedule(
  weekdayIsodow: number,
  parsed: ParsedLocalTime,
  now: Date = new Date(),
): Date {
  const targetJs = isoDowToJsDay(weekdayIsodow);
  const cur = new Date(now);
  for (let addDays = 0; addDays < 14; addDays++) {
    const d = new Date(cur);
    d.setDate(cur.getDate() + addDays);
    d.setHours(parsed.hour, parsed.minute, 0, 0);
    if (d.getDay() === targetJs && d.getTime() > now.getTime()) {
      return d;
    }
  }
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(parsed.hour, parsed.minute, 0, 0);
  return fallback;
}

export type ApplyMatchTemplateFormFields = {
  venue: string;
  maxPlayers: number;
  maxPlayersInputText: string;
  selectedGroupId: string | null;
  startsAt: Date;
  paymentMethod: MatchPaymentMethod;
  price: string;
  ibanAccountName: string;
  paymentNote: string;
  overrideIban: boolean;
  /** `overrideIban === true` iken `useTurkishIbanField` senkronu için ham compact IBAN. */
  ibanCompactForInput: string;
};

/**
 * Şablonu forma uygular; tarih/saat şablonda yoksa `fallbackStartsAt` kullanılır (genelde mevcut state).
 */
export function applyMatchTemplateToFormFields(
  template: MatchTemplate,
  options: { fallbackStartsAt: Date; now?: Date },
): ApplyMatchTemplateFormFields {
  const now = options.now ?? new Date();
  let startsAt = options.fallbackStartsAt;
  if (template.schedule) {
    const parsed = parseMatchTemplateLocalTime(template.schedule.localTime);
    if (parsed) {
      const raw = computeNextStartsAtForSchedule(
        template.schedule.weekdayIsodow,
        parsed,
        now,
      );
      startsAt = normalizeStartsAtFromPicker(raw);
    }
  }

  const priceStr =
    template.pricePerPerson != null && template.pricePerPerson > 0
      ? `${String(template.pricePerPerson).replace('.', ',')} ₺`
      : '';

  const useProfile = template.paymentMethod === 'iban' && template.ibanUsesProfile === true;
  const maxPlayers = clampEvenMatchMaxPlayers(template.maxPlayers);
  return {
    venue: template.venue,
    maxPlayers,
    maxPlayersInputText: String(maxPlayers),
    selectedGroupId: template.groupId ?? null,
    startsAt,
    paymentMethod: template.paymentMethod,
    price: priceStr,
    ibanAccountName: template.ibanAccountName ?? '',
    paymentNote: template.paymentNote ?? '',
    overrideIban: !useProfile,
    ibanCompactForInput: useProfile ? '' : (template.iban ?? ''),
  };
}

export type BuildMatchTemplateFromFormInput = {
  name: string;
  venue: string;
  maxPlayers: number;
  selectedGroupId: string | null;
  startsAt: Date;
  paymentMethod: MatchPaymentMethod | null;
  price: string;
  /** Profil IBAN’ı (compact). */
  profileIbanNorm: string;
  /** Alan IBAN’ı (compact), override açıkken. */
  ibanFieldNorm: string;
  ibanAccountName: string;
  paymentNote: string;
  overrideIban: boolean;
  hasValidProfileIban: boolean;
};

export type BuildMatchTemplateResult =
  | { ok: true; template: Omit<MatchTemplate, 'id'> }
  | { ok: false; message: string };

/**
 * Mevcut formdan şablon üretir; doğrulama `onSubmit` ile uyumlu (eksik IBAN vs.).
 */
export function buildMatchTemplateFromForm(input: BuildMatchTemplateFromFormInput): BuildMatchTemplateResult {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, message: 'Şablon adını girin.' };
  }
  if (name.length > MATCH_TEMPLATE_NAME_MAX_LEN) {
    return {
      ok: false,
      message: `Şablon adı en fazla ${MATCH_TEMPLATE_NAME_MAX_LEN} karakter olabilir.`,
    };
  }
  if (!input.venue.trim()) {
    return { ok: false, message: 'Saha adını girin.' };
  }
  if (!input.paymentMethod) {
    return { ok: false, message: 'Lütfen ödeme yöntemini seçin.' };
  }

  const schedule = {
    weekdayIsodow: jsDayToIsoDow(input.startsAt.getDay()),
    localTime: formatLocalTimeFromDate(input.startsAt),
  };

  const rawPrice = input.price.replace(/[^\d.,]/g, '');
  const priceNum = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : NaN;
  const pricePerPerson =
    input.paymentMethod === 'note_only'
      ? undefined
      : !Number.isNaN(priceNum) && priceNum > 0
        ? priceNum
        : undefined;

  const base: Omit<MatchTemplate, 'id' | 'iban' | 'ibanAccountName' | 'ibanUsesProfile' | 'paymentNote'> = {
    name,
    venue: input.venue.trim(),
    maxPlayers: input.maxPlayers,
    groupId: input.selectedGroupId ?? undefined,
    schedule,
    paymentMethod: input.paymentMethod,
    pricePerPerson,
  };

  if (input.paymentMethod === 'iban') {
    const useProfile = !input.overrideIban && input.hasValidProfileIban;
    const ibanNormForMatch = useProfile ? input.profileIbanNorm : input.ibanFieldNorm;
    if (!useProfile && (ibanNormForMatch.length === 0 || !isValidTurkishIban(ibanNormForMatch))) {
      return {
        ok: false,
        message:
          'Türkiye IBAN’ı TR ile başlamalı, toplam 26 karakter olmalı ve kontrol basamağı doğru olmalı.',
      };
    }
    const ibanAccountNameNorm = input.ibanAccountName.trim().toLocaleUpperCase('tr-TR');
    if (ibanAccountNameNorm.length === 0) {
      return { ok: false, message: 'IBAN alıcı ad soyad bilgisini girin.' };
    }
    return {
      ok: true,
      template: {
        ...base,
        ibanUsesProfile: useProfile,
        iban: useProfile ? undefined : ibanNormForMatch,
        ibanAccountName: ibanAccountNameNorm,
      },
    };
  }

  if (input.paymentMethod === 'cash') {
    return { ok: true, template: { ...base } };
  }

  const paymentNoteNorm = input.paymentNote.trim();
  if (paymentNoteNorm.length === 0) {
    return { ok: false, message: 'Sadece not ekle seçeneğinde ödeme notu zorunludur.' };
  }
  if (paymentNoteNorm.length > 120) {
    return { ok: false, message: 'Ödeme notu en fazla 120 karakter olabilir.' };
  }
  return {
    ok: true,
    template: {
      ...base,
      paymentNote: paymentNoteNorm,
    },
  };
}
