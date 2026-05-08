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
};

export class AppError extends Error {
  code: AppErrorCode;
  operation: string;
  retryable: boolean;
  cause?: unknown;
  meta?: Record<string, unknown>;

  constructor(params: AppErrorParams) {
    super(params.message ?? defaultMessageForCode(params.code));
    this.name = 'AppError';
    this.code = params.code;
    this.operation = params.operation;
    this.retryable = params.retryable ?? isRetryableCode(params.code);
    this.cause = params.cause;
    this.meta = params.meta;
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

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function mapSupabaseError(
  error: unknown,
  operation: string,
  fallbackMessage?: string,
): AppError {
  if (isAppError(error)) return error;

  const parsed = parseSupabaseLikeError(error);
  const code = classifySupabaseError(parsed);
  const message =
    fallbackMessage ?? buildUserFacingMessage(parsed, code, operation);

  return new AppError({
    code,
    operation,
    message,
    cause: error,
    retryable: isRetryableCode(code),
    meta: {
      supabase: parsed,
    },
  });
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

export function toUserMessage(error: unknown, fallback = 'Bir hata oluştu.'): string {
  if (isAppError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function shouldRetry(error: unknown): boolean {
  return isAppError(error) ? error.retryable : false;
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

function classifySupabaseError(error: SupabaseLikeError): AppErrorCode {
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
