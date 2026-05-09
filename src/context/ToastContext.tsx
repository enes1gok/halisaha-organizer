import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ToastHost } from '../components/ToastHost';
import type { ShowToastOptions } from './toastTypes';

export type { ShowToastOptions, ToastVariant } from './toastTypes';

type ToastEntry = {
  payload: ShowToastOptions;
  id: number;
};

type ToastContextValue = {
  showToast: (opts: ShowToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((opts: ShowToastOptions) => {
    idRef.current += 1;
    setEntry({ payload: opts, id: idRef.current });
  }, []);

  const hideToast = useCallback(() => {
    setEntry(null);
  }, []);

  const dismissIfMatches = useCallback((requestId: number) => {
    setEntry((current) => (current?.id === requestId ? null : current));
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      hideToast,
    }),
    [hideToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost entry={entry} onConsumed={dismissIfMatches} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
