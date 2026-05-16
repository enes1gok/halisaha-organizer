import type { ErrorTranslationKey } from '../../i18n/errorTranslationKeys';
import type { ErrorLocale } from '../../i18n/translateError';
import { translateError } from '../../i18n/translateError';

export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN';

type AppErrorParams = {
  code: AppErrorCode;
  operation: string;
  message?: string;
  retryable?: boolean;
  cause?: unknown;
  meta?: Record<string, unknown>;
  /** Correlates client logs / support reports (optional). */
  traceId?: string;
  /** Stable key for i18n (Postgres constraint name or RPC ERR_* mapping). */
  translationKey?: ErrorTranslationKey;
  translationParams?: Record<string, string | number>;
  locale?: ErrorLocale;
};

export class AppError extends Error {
  code: AppErrorCode;
  operation: string;
  retryable: boolean;
  cause?: unknown;
  meta?: Record<string, unknown>;
  /** Same as meta.traceId when set (convenience). */
  traceId?: string;
  translationKey?: ErrorTranslationKey;
  translationParams?: Record<string, string | number>;

  constructor(params: AppErrorParams) {
    const locale = params.locale ?? 'tr';
    const resolved =
      params.translationKey != null
        ? translateError(params.translationKey, locale, params.translationParams)
        : params.message ?? defaultMessageForCode(params.code);
    super(resolved);
    this.name = 'AppError';
    this.code = params.code;
    this.operation = params.operation;
    this.retryable = params.retryable ?? isRetryableCode(params.code);
    this.cause = params.cause;
    this.traceId = params.traceId;
    const meta = params.meta ? { ...params.meta } : {};
    if (params.traceId) meta.traceId = params.traceId;
    this.meta = Object.keys(meta).length > 0 ? meta : undefined;
    this.translationKey = params.translationKey;
    this.translationParams = params.translationParams;
  }
}

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  name?: string;
};

/** Postgres CHECK / UNIQUE constraint name → translation key */
const CONSTRAINT_TO_TRANSLATION_KEY: Record<string, ErrorTranslationKey> = {
  matches_max_players_chk: 'errors.db.matches_max_players_chk',
  matches_scores_consistency_chk: 'errors.db.matches_scores_consistency_chk',
  matches_starts_at_upper_chk: 'errors.db.matches_starts_at_upper_chk',
  matches_payment_method_chk: 'errors.db.matches_payment_method_chk',
  matches_payment_note_chk: 'errors.db.matches_payment_note_chk',
  profiles_display_name_len_chk: 'errors.db.profiles_display_name_len_chk',
  groups_name_check: 'errors.db.groups_name_check',
  notification_deliveries_reminder_date_chk: 'errors.db.notification_delivery_invalid',
  notification_deliveries_match_group_ctx_chk: 'errors.db.notification_delivery_invalid',
  notification_deliveries_type_check: 'errors.db.notification_delivery_invalid',
};

/** RPC/trigger ERR_* message token → translation key + classification */
const ERR_REGISTRY: Record<
  string,
  { key: ErrorTranslationKey; code: AppErrorCode }
> = {
  ERR_AUTH_REQUIRED: { key: 'errors.rpc.authRequired', code: 'AUTH_REQUIRED' },
  ERR_FORBIDDEN: { key: 'errors.rpc.forbidden', code: 'FORBIDDEN' },
  ERR_MATCH_LINEUP_LOCKED: {
    key: 'errors.rpc.matchLineupLocked',
    code: 'VALIDATION',
  },
  ERR_GROUP_LEADERBOARD_FORBIDDEN: {
    key: 'errors.rpc.groupLeaderboardForbidden',
    code: 'FORBIDDEN',
  },
  ERR_MATCH_CREATE_GROUP_FORBIDDEN: {
    key: 'errors.rpc.matchCreateGroupForbidden',
    code: 'FORBIDDEN',
  },
  ERR_MATCH_PAYMENT_METHOD_INVALID: {
    key: 'errors.rpc.matchPaymentMethodInvalid',
    code: 'VALIDATION',
  },
  ERR_MATCH_PAYMENT_IBAN_REQUIRED: {
    key: 'errors.rpc.matchPaymentIbanRequired',
    code: 'VALIDATION',
  },
  ERR_MATCH_PAYMENT_NOTE_REQUIRED: {
    key: 'errors.rpc.matchPaymentNoteRequired',
    code: 'VALIDATION',
  },
  ERR_MATCH_PAYMENT_NOTE_TOO_LONG: {
    key: 'errors.rpc.matchPaymentNoteTooLong',
    code: 'VALIDATION',
  },
  ERR_MATCH_STARTS_AT_PAST: {
    key: 'errors.rpc.matchStartsAtPast',
    code: 'VALIDATION',
  },
  ERR_GROUP_NAME_MIN: { key: 'errors.rpc.groupNameMin', code: 'VALIDATION' },
  ERR_GROUP_NAME_MAX: { key: 'errors.rpc.groupNameMax', code: 'VALIDATION' },
  ERR_GROUP_NOT_FOUND: { key: 'errors.rpc.groupNotFound', code: 'NOT_FOUND' },
  ERR_GROUP_DELETE_FORBIDDEN: { key: 'errors.rpc.groupDeleteForbidden', code: 'FORBIDDEN' },
  ERR_MATCH_NOT_FOUND: { key: 'errors.rpc.matchNotFound', code: 'NOT_FOUND' },
  ERR_MATCH_SCORE_BEFORE_END: {
    key: 'errors.rpc.matchScoreBeforeEnd',
    code: 'VALIDATION',
  },
  ERR_RATING_CANNOT_PARTICIPATE: {
    key: 'errors.rpc.ratingCannotParticipate',
    code: 'FORBIDDEN',
  },
  ERR_RATING_FINISHED_ONLY: {
    key: 'errors.rpc.ratingFinishedOnly',
    code: 'VALIDATION',
  },
  ERR_RATING_INVALID_RATEE: {
    key: 'errors.rpc.ratingInvalidRatee',
    code: 'VALIDATION',
  },
  ERR_RATING_SCORE_RANGE: {
    key: 'errors.rpc.ratingScoreRange',
    code: 'VALIDATION',
  },
  ERR_RATING_RATEE_INELIGIBLE: {
    key: 'errors.rpc.ratingRateeIneligible',
    code: 'VALIDATION',
  },
  ERR_MOTM_CANNOT_VOTE: {
    key: 'errors.rpc.motmCannotVote',
    code: 'FORBIDDEN',
  },
  ERR_MOTM_INVALID_PICK: {
    key: 'errors.rpc.motmInvalidPick',
    code: 'VALIDATION',
  },
  ERR_MOTM_FINISHED_ONLY: {
    key: 'errors.rpc.motmFinishedOnly',
    code: 'VALIDATION',
  },
  ERR_MOTM_PLAYER_NOT_ON_FIELD: {
    key: 'errors.rpc.motmPlayerNotOnField',
    code: 'VALIDATION',
  },
  ERR_RATING_WINDOW_CLOSED: {
    key: 'errors.rpc.ratingWindowClosed',
    code: 'VALIDATION',
  },
  ERR_MATCH_ROSTER_FULL: {
    key: 'errors.rpc.matchRosterFull',
    code: 'VALIDATION',
  },
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Options for {@link mapSupabaseError} (third argument when not a plain fallback string). */
export type MapSupabaseErrorOptions = {
  fallbackMessage?: string;
  traceId?: string;
  /** Safe subset of request input for debugging (no tokens / PII). */
  requestPayload?: Record<string, unknown>;
};

export function generateTraceId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function mapSupabaseError(
  error: unknown,
  operation: string,
  fallbackMessage?: string,
): AppError;
export function mapSupabaseError(
  error: unknown,
  operation: string,
  options: MapSupabaseErrorOptions,
): AppError;
export function mapSupabaseError(
  error: unknown,
  operation: string,
  third?: string | MapSupabaseErrorOptions,
): AppError {
  if (isAppError(error)) return error;

  const opts: MapSupabaseErrorOptions =
    typeof third === 'string' ? { fallbackMessage: third } : third ?? {};
  const fallbackMessage = opts.fallbackMessage;

  const parsed = parseSupabaseLikeError(error);
  const pgDetail = parsePgDetail(parsed.details);
  const errToken = extractErrToken(combinedSupabaseText(parsed));
  if (errToken && ERR_REGISTRY[errToken]) {
    const { key, code } = ERR_REGISTRY[errToken];
    return new AppError({
      code,
      operation,
      translationKey: key,
      cause: error,
      retryable: isRetryableCode(code),
      traceId: opts.traceId,
      meta: mergeErrorMeta({ supabase: parsed, errToken }, opts, pgDetail),
    });
  }

  const constraintName = extractConstraintName(combinedSupabaseText(parsed));
  if (constraintName && CONSTRAINT_TO_TRANSLATION_KEY[constraintName]) {
    const key = CONSTRAINT_TO_TRANSLATION_KEY[constraintName];
    return new AppError({
      code: 'VALIDATION',
      operation,
      translationKey: key,
      cause: error,
      retryable: false,
      traceId: opts.traceId,
      meta: mergeErrorMeta({ supabase: parsed, constraintName }, opts, pgDetail),
    });
  }

  const missingRpc = detectMissingDeployedRpc(parsed);
  if (missingRpc) {
    return new AppError({
      code: 'UNKNOWN',
      operation,
      translationKey: 'errors.rpc.backendSchemaOutdated',
      cause: error,
      retryable: false,
      traceId: opts.traceId,
      meta: mergeErrorMeta(
        {
          supabase: parsed,
          errToken: 'ERR_BACKEND_SCHEMA_OUTDATED',
          rpcName: missingRpc,
        },
        opts,
        pgDetail,
      ),
    });
  }

  const code = classifySupabaseError(parsed);
  const message =
    fallbackMessage ?? buildUserFacingMessage(parsed, code, operation);

  return new AppError({
    code,
    operation,
    message,
    cause: error,
    retryable: isRetryableCode(code),
    traceId: opts.traceId,
    meta: mergeErrorMeta({ supabase: parsed }, opts, pgDetail),
  });
}

/** One-line technical bundle for support / dev (Turkish UI may still use {@link toUserMessage}). */
export function formatTechnicalErrorSummary(err: AppError): string {
  const lines: string[] = [];
  lines.push(`operation: ${err.operation}`);
  if (err.traceId) lines.push(`traceId: ${err.traceId}`);
  lines.push(`code: ${err.code}`);
  if (err.translationKey) lines.push(`translationKey: ${err.translationKey}`);
  const m = err.meta;
  if (m?.errToken) lines.push(`errToken: ${String(m.errToken)}`);
  if (m?.rpcName) lines.push(`rpcName: ${String(m.rpcName)}`);
  if (m?.constraintName) lines.push(`constraint: ${String(m.constraintName)}`);
  if (m?.pgDetail && typeof m.pgDetail === 'object') {
    try {
      lines.push(`pgDetail: ${JSON.stringify(m.pgDetail)}`);
    } catch {
      lines.push('pgDetail: [unserializable]');
    }
  }
  if (m?.requestPayload && typeof m.requestPayload === 'object') {
    try {
      lines.push(`request: ${JSON.stringify(m.requestPayload)}`);
    } catch {
      lines.push('request: [unserializable]');
    }
  }
  const sup = m?.supabase as SupabaseLikeError | undefined;
  if (sup?.code != null) lines.push(`pgCode: ${String(sup.code)}`);
  return lines.join('\n');
}

function mergeErrorMeta(
  base: Record<string, unknown>,
  opts: MapSupabaseErrorOptions,
  pgDetail?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  if (opts.traceId) out.traceId = opts.traceId;
  if (opts.requestPayload) out.requestPayload = opts.requestPayload;
  if (pgDetail) out.pgDetail = pgDetail;
  return out;
}

function parsePgDetail(details: string | null | undefined): Record<string, unknown> | undefined {
  if (details == null || typeof details !== 'string') return undefined;
  const t = details.trim();
  if (!t.startsWith('{')) return undefined;
  try {
    const o = JSON.parse(t) as unknown;
    if (o !== null && typeof o === 'object' && !Array.isArray(o)) {
      return o as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function createAuthRequiredError(operation: string, message?: string): AppError {
  return new AppError({
    code: 'AUTH_REQUIRED',
    operation,
    message: message ?? defaultMessageForCode('AUTH_REQUIRED'),
    retryable: false,
  });
}

export function createNotFoundError(operation: string, message = 'Kayıt bulunamadı'): AppError {
  return new AppError({
    code: 'NOT_FOUND',
    operation,
    message,
    retryable: false,
  });
}

export function toUserMessage(
  error: unknown,
  fallback = 'Bir hata oluştu.',
  locale: ErrorLocale = 'tr',
): string {
  if (isAppError(error)) {
    if (error.translationKey) {
      return translateError(error.translationKey, locale, error.translationParams);
    }
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function shouldRetry(error: unknown): boolean {
  return isAppError(error) ? error.retryable : false;
}

function extractErrToken(text: string): string | undefined {
  const m = text.match(/\b(ERR_[A-Z0-9_]+)\b/);
  return m?.[1];
}

function extractConstraintName(text: string): string | undefined {
  const m = text.match(/check constraint "([^"]+)"/i);
  if (m?.[1]) return m[1];
  const m2 = text.match(/unique constraint "([^"]+)"/i);
  return m2?.[1];
}

function parseSupabaseLikeError(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== 'object') {
    return { message: typeof error === 'string' ? error : undefined };
  }
  const e = error as Record<string, unknown>;
  const codeRaw = e.code;
  const code =
    typeof codeRaw === 'string'
      ? codeRaw
      : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
        ? String(codeRaw)
        : undefined;
  return {
    code,
    message: typeof e.message === 'string' ? e.message : undefined,
    details: typeof e.details === 'string' ? e.details : null,
    hint: typeof e.hint === 'string' ? e.hint : null,
    status: typeof e.status === 'number' ? e.status : undefined,
    name: typeof e.name === 'string' ? e.name : undefined,
  };
}

function combinedSupabaseText(parsed: SupabaseLikeError): string {
  return [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(' ');
}

/**
 * Bilinen RPC adlarına göre PostgREST `PGRST202` ("function not found in schema cache")
 * dedektörü. Eşleşen RPC adı dönerse `mapSupabaseError` kullanıcıya `backendSchemaOutdated`
 * çevirisini gösterir ve teknik detayda `rpcName` paylaşılır.
 *
 * `paramHints` opsiyoneldir; bir RPC için belirli parametre adlarına bakılması gerekiyorsa
 * (ör. `create_match_with_organizer_attendee` payment alanları) kullanılır. Bunlar yoksa
 * yalnızca RPC adının PGRST202 metninde geçmesi yeterlidir.
 */
const KNOWN_PGRST202_RPCS: Array<{ name: string; paramHints?: string[] }> = [
  {
    name: 'create_match_with_organizer_attendee',
    paramHints: ['p_payment_method', 'p_iban_account_name', 'p_payment_note'],
  },
  { name: 'delete_group' },
];

function detectMissingDeployedRpc(parsed: SupabaseLikeError): string | undefined {
  if ((parsed.code ?? '').toUpperCase() !== 'PGRST202') return undefined;
  const lower = combinedSupabaseText(parsed).toLowerCase();
  for (const entry of KNOWN_PGRST202_RPCS) {
    if (!lower.includes(entry.name)) continue;
    if (!entry.paramHints || entry.paramHints.length === 0) {
      return entry.name;
    }
    if (entry.paramHints.some((hint) => lower.includes(hint))) {
      return entry.name;
    }
  }
  return undefined;
}

function classifySupabaseError(error: SupabaseLikeError): AppErrorCode {
  const token = extractErrToken(combinedSupabaseText(error));
  if (token && ERR_REGISTRY[token]) {
    return ERR_REGISTRY[token].code;
  }

  const code = (error.code ?? '').toUpperCase();
  const message = (error.message ?? '').toLowerCase();
  const details = (error.details ?? '').toLowerCase();
  const hint = (error.hint ?? '').toLowerCase();
  const combined = `${message} ${details} ${hint}`;
  const status = error.status ?? 0;

  if (
    combined.includes('grup adı') &&
    (combined.includes('karakter') || combined.includes('en az') || combined.includes('en fazla'))
  ) {
    return 'VALIDATION';
  }

  if (
    combined.includes('oturum gerekli') ||
    combined.includes('giriş yapmanız') ||
    message.includes('session required')
  ) {
    return 'AUTH_REQUIRED';
  }

  if (
    status === 401 ||
    code === '401' ||
    code === 'PGRST301' ||
    message.includes('not authenticated') ||
    message.includes('invalid jwt') ||
    message.includes('jwt')
  ) {
    return 'AUTH_REQUIRED';
  }

  if (status === 403 || code === '403' || code === '42501' || message.includes('permission denied')) {
    return 'FORBIDDEN';
  }

  if (
    status === 404 ||
    code === '404' ||
    code === 'PGRST116' ||
    message.includes('no rows') ||
    message.includes('not found')
  ) {
    return 'NOT_FOUND';
  }

  if (code === '23505' || message.includes('duplicate key')) {
    return 'CONFLICT';
  }

  if (code === '23503' || combined.includes('violates foreign key constraint')) {
    return 'UNKNOWN';
  }

  if (
    code === '23502' ||
    code === '23514' ||
    code.startsWith('22') ||
    message.includes('invalid input syntax') ||
    message.includes('violates check constraint')
  ) {
    return 'VALIDATION';
  }

  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('socket') ||
    combined.includes('network request failed') ||
    combined.includes('failed to fetch')
  ) {
    return 'NETWORK';
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'NETWORK';
  }

  return 'UNKNOWN';
}

function buildUserFacingMessage(
  parsed: SupabaseLikeError,
  code: AppErrorCode,
  operation: string,
): string {
  const raw = combinedSupabaseText(parsed);
  const lower = raw.toLowerCase();

  if (code === 'AUTH_REQUIRED') {
    return defaultMessageForCode('AUTH_REQUIRED');
  }

  if (code === 'NETWORK') {
    return defaultMessageForCode('NETWORK');
  }

  if (code === 'FORBIDDEN') {
    return defaultMessageForCode('FORBIDDEN');
  }

  if (code === 'NOT_FOUND') {
    return defaultMessageForCode('NOT_FOUND');
  }

  if (
    code === 'CONFLICT' &&
    (lower.includes('join_code') || lower.includes('groups_join_code') || lower.includes('unique constraint'))
  ) {
    return 'Katılım kodu çakışması oluştu. Lütfen bir süre sonra tekrar deneyin.';
  }

  if (code === 'CONFLICT') {
    return defaultMessageForCode('CONFLICT');
  }

  if (
    code === 'VALIDATION' &&
    (lower.includes('char_length') ||
      lower.includes('groups_name') ||
      (lower.includes('check constraint') && lower.includes('groups')) ||
      (operation.includes('createGroup') && lower.includes('constraint')))
  ) {
    return 'Grup adı en az 2 karakter olmalı.';
  }

  if (
    code === 'VALIDATION' &&
    lower.includes('grup adı') &&
    (lower.includes('en fazla') || lower.includes('80'))
  ) {
    const msg = parsed.message?.trim();
    if (msg && msg.length <= 200) return msg;
    return 'Grup adı en fazla 80 karakter olabilir.';
  }

  if (code === 'VALIDATION' && lower.includes('grup adı')) {
    const msg = parsed.message?.trim();
    if (msg && msg.length <= 200) return msg;
  }

  if (code === 'VALIDATION') {
    const trimmed = raw.trim();
    if (trimmed.length > 0 && trimmed.length <= 220 && !trimmed.includes('\n')) {
      return `Gönderilen bilgiler geçersiz: ${trimmed}`;
    }
    return defaultMessageForCode('VALIDATION');
  }

  if (parsed.code === '23503' || lower.includes('foreign key')) {
    if (lower.includes('profiles') || lower.includes('owner_id') || lower.includes('player_id')) {
      return 'Profil kaydınız eksik veya senkronize değil. Çıkış yapıp tekrar giriş yapın veya bir süre sonra tekrar deneyin.';
    }
    return 'Bağlı kayıt bulunamadığı için işlem tamamlanamadı. Oturumu yenileyip tekrar deneyin.';
  }

  const human = pickHumanReadableServerLine(parsed);
  if (human && (code === 'UNKNOWN' || code === 'VALIDATION')) {
    if (!isUnsafeToShowServerLine(human)) {
      return `İşlem tamamlanamadı: ${human}`;
    }
  }

  return defaultMessageForCode(code);
}

/** PostgREST sık sık asıl metni `details` veya çok satırlı context içinde döner; `message` boş veya jenerik kalabilir. */
function pickHumanReadableServerLine(parsed: SupabaseLikeError): string | undefined {
  const ordered = [parsed.message, parsed.details, parsed.hint].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  );
  for (const block of ordered) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const stripped = line.replace(/^ERROR:\s*/i, '').trim();
      if (stripped.length === 0) continue;
      if (stripped.toLowerCase() === 'internal server error') continue;
      const maxLen = 280;
      return stripped.length <= maxLen ? stripped : `${stripped.slice(0, maxLen)}…`;
    }
  }
  return undefined;
}

function isUnsafeToShowServerLine(_line: string): boolean {
  const lower = _line.toLowerCase();
  if (lower.includes('\n')) return true;
  if (lower.includes('syntax error at') || lower.includes('unexpected character')) return true;
  if (lower.includes('relation') && lower.includes('does not exist')) return true;
  return false;
}

function defaultMessageForCode(code: AppErrorCode): string {
  switch (code) {
    case 'AUTH_REQUIRED':
      return 'Bu işlem için giriş yapmanız gerekiyor.';
    case 'FORBIDDEN':
      return 'Bu işlem için yetkiniz bulunmuyor.';
    case 'NOT_FOUND':
      return 'İlgili kayıt bulunamadı veya erişilemez durumda.';
    case 'CONFLICT':
      return 'Bu işlem mevcut verilerle çakışıyor. Sayfayı yenileyip tekrar deneyin.';
    case 'VALIDATION':
      return 'Gönderilen bilgiler geçersiz. Lütfen alanları kontrol edin.';
    case 'NETWORK':
      return 'Ağ bağlantısı sorunu oluştu. İnternetinizi kontrol edip tekrar deneyin.';
    case 'UNKNOWN':
    default:
      return 'Beklenmeyen bir hata oluştu.';
  }
}

function isRetryableCode(code: AppErrorCode): boolean {
  return code === 'NETWORK' || code === 'UNKNOWN';
}
