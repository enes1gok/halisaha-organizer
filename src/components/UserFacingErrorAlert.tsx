import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import {
  formatTechnicalErrorSummary,
  isAppError,
  mapSupabaseError,
  toUserMessage,
  type AppError,
} from '../services/supabase/errors';
import { reportError } from '../services/logging/reportError';

export type ShowUserFacingErrorOptions = {
  /** Stable id for this UI surface (logging). */
  uiOperation: string;
  fallbackMessage: string;
  /** When `error` is not yet an {@link AppError}, map with this operation string. */
  mapOperation?: string;
};

export function showUserFacingErrorAlert(error: unknown, options: ShowUserFacingErrorOptions): void {
  const mapOp = options.mapOperation ?? options.uiOperation;
  const normalized: AppError = isAppError(error)
    ? error
    : mapSupabaseError(error, mapOp);

  reportError({
    error: normalized,
    operation: options.uiOperation,
    traceId: normalized.traceId,
  });

  const userLine = toUserMessage(normalized, options.fallbackMessage);
  const tech = formatTechnicalErrorSummary(normalized);

  Alert.alert('Hata', userLine, [
    { text: 'Tamam', style: 'cancel' },
    {
      text: 'Teknik detay',
      onPress: () => {
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
    },
  ]);
}
