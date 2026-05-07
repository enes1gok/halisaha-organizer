import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_COPIED_MS = 2000;

type Options = {
  idleLabel: string;
  copiedLabel?: string;
  copiedDurationMs?: number;
};

/**
 * Runs an async copy action and briefly shows `copiedLabel` on the button label.
 * If `copyFn` resolves to `false`, feedback is skipped. Timer is cleared on unmount and before each new flash.
 */
export function useClipboardCopyFeedback({
  idleLabel,
  copiedLabel = 'Kopyalandı',
  copiedDurationMs = DEFAULT_COPIED_MS,
}: Options) {
  const [label, setLabel] = useState(idleLabel);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCopied = label === copiedLabel;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const runCopy = useCallback(
    async (copyFn: () => Promise<boolean | void>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      try {
        const ok = await copyFn();
        if (ok === false) return;
      } catch {
        return;
      }
      setLabel(copiedLabel);
      timerRef.current = setTimeout(() => {
        setLabel(idleLabel);
        timerRef.current = null;
      }, copiedDurationMs);
    },
    [copiedDurationMs, copiedLabel, idleLabel],
  );

  return { label, runCopy, isCopied };
}
