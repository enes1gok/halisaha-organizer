import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';

export type AppIntroCompletionStatus = 'loading' | 'needs_intro' | 'completed';

export async function isAppIntroMarkedComplete(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEYS.appIntroCompleted);
  return v === '1';
}

export async function markAppIntroCompleteInStorage(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.appIntroCompleted, '1');
}

/**
 * Oturum öncesi ürün intro’sunun görülüp görülmediği (cihaz yereli).
 * Sil-yükle sonrası anahtar gider; intro yeniden gösterilir.
 */
export function useAppIntroCompletion(): {
  status: AppIntroCompletionStatus;
  markCompleted: () => Promise<void>;
} {
  const [status, setStatus] = useState<AppIntroCompletionStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    isAppIntroMarkedComplete().then((done) => {
      if (!cancelled) {
        setStatus(done ? 'completed' : 'needs_intro');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markCompleted = useCallback(async () => {
    await markAppIntroCompleteInStorage();
    setStatus('completed');
  }, []);

  return { status, markCompleted };
}
