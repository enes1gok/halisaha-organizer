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

  return new AppError({
    code,
    operation,
    message: fallbackMessage ?? defaultMessageForCode(code),
    cause: error,
    retryable: isRetryableCode(code),
    meta: {
      supabase: parsed,
    },
  });
}

export function createAuthRequiredError(operation: string, message = 'Oturum gerekli'): AppError {
  return new AppError({
    code: 'AUTH_REQUIRED',
    operation,
    message,
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
    switch (error.code) {
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
        return error.message || fallback;
    }
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
  return {
    code: typeof e.code === 'string' ? e.code : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
    details: typeof e.details === 'string' ? e.details : null,
    hint: typeof e.hint === 'string' ? e.hint : null,
    status: typeof e.status === 'number' ? e.status : undefined,
    name: typeof e.name === 'string' ? e.name : undefined,
  };
}

function classifySupabaseError(error: SupabaseLikeError): AppErrorCode {
  const code = (error.code ?? '').toUpperCase();
  const message = (error.message ?? '').toLowerCase();
  const status = error.status ?? 0;

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
    message.includes('socket')
  ) {
    return 'NETWORK';
  }

  return 'UNKNOWN';
}

function defaultMessageForCode(code: AppErrorCode): string {
  switch (code) {
    case 'AUTH_REQUIRED':
      return 'Oturum gerekli.';
    case 'FORBIDDEN':
      return 'Bu işlem için yetkiniz yok.';
    case 'NOT_FOUND':
      return 'İlgili kayıt bulunamadı.';
    case 'CONFLICT':
      return 'Veri çakışması oluştu.';
    case 'VALIDATION':
      return 'Geçersiz veri gönderildi.';
    case 'NETWORK':
      return 'Ağ bağlantısı hatası oluştu.';
    case 'UNKNOWN':
    default:
      return 'Beklenmeyen bir hata oluştu.';
  }
}

function isRetryableCode(code: AppErrorCode): boolean {
  return code === 'NETWORK' || code === 'UNKNOWN';
}
