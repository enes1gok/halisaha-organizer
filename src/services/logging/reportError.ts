import { formatTechnicalErrorSummary, isAppError, type AppError } from '../supabase/errors';

export type ReportErrorInput = {
  error: unknown;
  /** Prefer {@link AppError.operation} when error is mapped. */
  operation?: string;
  traceId?: string;
  /** Extra safe context (no secrets). */
  extra?: Record<string, unknown>;
};

function normalizePayload(input: ReportErrorInput): Record<string, unknown> {
  const err = input.error;
  if (isAppError(err)) {
    return {
      operation: input.operation ?? err.operation,
      traceId: input.traceId ?? err.traceId,
      code: err.code,
      translationKey: err.translationKey,
      summary: formatTechnicalErrorSummary(err),
      extra: input.extra,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    operation: input.operation ?? 'unknown',
    traceId: input.traceId,
    message: msg,
    extra: input.extra,
  };
}

/** Central hook for observability; Development logs a single structured line. */
export function reportError(input: ReportErrorInput): void {
  const payload = normalizePayload(input);
  if (__DEV__) {
    console.warn('[reportError]', payload);
  }
}
