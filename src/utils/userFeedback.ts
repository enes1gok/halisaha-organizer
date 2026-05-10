import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import type { ShowToastOptions } from '../context/toastTypes';
import { useToast } from '../context/ToastContext';
import { reportError } from '../services/logging/reportError';
import {
  formatTechnicalErrorSummary,
  isAppError,
  mapSupabaseError,
  toUserMessage,
  type AppError,
} from '../services/supabase/errors';

export type ShowToastFn = (opts: ShowToastOptions) => void;

export type ShowUserFacingErrorOptions = {
  /** Stable id for this UI surface (logging). */
  uiOperation: string;
  fallbackMessage: string;
  /** When `error` is not yet an {@link AppError}, map with this operation string. */
  mapOperation?: string;
};

export type ShowApiErrorToastOptions = {
  uiOperation: string;
  fallbackMessage: string;
  mapOperation?: string;
  /** Varsayılan: "Hata" */
  toastTitle?: string;
  /** İkincil eylem (ör. ağ hatasında tekrar dene). */
  retry?: { label?: string; onPress: () => void };
};

export function showValidationToast(showToast: ShowToastFn, title: string, message?: string): void {
  showToast({ title, message, variant: 'warning' });
}

export function showApiErrorToast(
  showToast: ShowToastFn,
  error: unknown,
  options: ShowApiErrorToastOptions,
): void {
  const mapOp = options.mapOperation ?? options.uiOperation;
  const normalized: AppError = isAppError(error) ? error : mapSupabaseError(error, mapOp);

  reportError({
    error: normalized,
    operation: options.uiOperation,
    traceId: normalized.traceId,
  });

  const userLine = toUserMessage(normalized, options.fallbackMessage);
  showToast({
    title: options.toastTitle ?? 'Hata',
    message: userLine,
    variant: 'error',
    durationMs: options.retry ? 6500 : 5500,
    actionLabel: options.retry ? (options.retry.label ?? 'Tekrar dene') : undefined,
    onActionPress: options.retry?.onPress,
  });
}

/**
 * Sunucu hatası: önce toast; "Teknik detay" ikinci bir sistem diyalogunda (kopyalama ile).
 */
export function showUserFacingError(
  showToast: ShowToastFn,
  error: unknown,
  options: ShowUserFacingErrorOptions,
): void {
  const mapOp = options.mapOperation ?? options.uiOperation;
  const normalized: AppError = isAppError(error) ? error : mapSupabaseError(error, mapOp);

  reportError({
    error: normalized,
    operation: options.uiOperation,
    traceId: normalized.traceId,
  });

  const userLine = toUserMessage(normalized, options.fallbackMessage);
  const tech = formatTechnicalErrorSummary(normalized);

  showToast({
    title: 'Hata',
    message: userLine,
    variant: 'error',
    durationMs: 6000,
    actionLabel: 'Teknik detay',
    onActionPress: () => {
      Alert.alert('Teknik detay', tech, [
        {
          text: 'Kopyala',
          onPress: () => {
            void Clipboard.setStringAsync(tech);
          },
        },
        { text: 'Kapat', style: 'cancel' },
      ]);
    },
  });
}

export function useUserFeedback() {
  const { showToast } = useToast();

  const bound = useMemo(
    () => ({
      showValidationToast: (title: string, message?: string) =>
        showValidationToast(showToast, title, message),
      showApiErrorToast: (error: unknown, options: ShowApiErrorToastOptions) =>
        showApiErrorToast(showToast, error, options),
      showUserFacingError: (error: unknown, options: ShowUserFacingErrorOptions) =>
        showUserFacingError(showToast, error, options),
      showToast,
    }),
    [showToast],
  );

  return bound;
}

/** Tek seferlik işlemde callback içinde toast gerekiyorsa */
export function useShowToast(): ShowToastFn {
  const { showToast } = useToast();
  return useCallback((opts: ShowToastOptions) => showToast(opts), [showToast]);
}
