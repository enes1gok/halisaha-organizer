import { isAppError, shouldRetry, toUserMessage } from '../services/supabase/errors';

export function rethrowUseCaseError(action: string, error: unknown, fallbackMessage: string): never {
  if (isAppError(error)) {
    console.warn(`[usecase] ${action} failed`, {
      code: error.code,
      operation: error.operation,
      message: error.message,
      retryable: shouldRetry(error),
      supabase: error.meta?.supabase,
    });
    throw error;
  }

  throw new Error(toUserMessage(error, fallbackMessage));
}
