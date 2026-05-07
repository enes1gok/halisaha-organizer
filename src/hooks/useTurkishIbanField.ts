import { useCallback, useState } from 'react';
import { formatIbanForInput, normalizeIban, sanitizeTurkishIbanInput } from '../utils/iban';

/** Shared IBAN input behavior (TR prefix on focus, grouping, sanitization). */
export function useTurkishIbanField(stored?: string) {
  const [iban, setIban] = useState(() =>
    stored ? formatIbanForInput(normalizeIban(stored)) : '',
  );

  const syncFromStored = useCallback((value?: string) => {
    const n = value ? normalizeIban(value) : '';
    setIban(n ? formatIbanForInput(n) : '');
  }, []);

  const onChange = useCallback((text: string) => {
    setIban(formatIbanForInput(sanitizeTurkishIbanInput(text)));
  }, []);

  const onFocus = useCallback(() => {
    setIban((prev) => (normalizeIban(prev).length > 0 ? prev : formatIbanForInput('TR')));
  }, []);

  return { iban, setIban, syncFromStored, onChange, onFocus };
}
