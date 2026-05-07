/** Masks IBAN for display: TR12 **** **** **** **90 */
export function maskIban(iban: string): string {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (cleaned.length < 8) return cleaned;
  const start = cleaned.slice(0, 4);
  const end = cleaned.slice(-4);
  return `${start} •••• •••• •••• ${end}`;
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

/** Turkish IBAN display: TRkk xxxx xxxx xxxx xxxx xxxx xx */
export function formatIbanForInput(normalized: string): string {
  const n = normalized.slice(0, 26);
  if (n.length <= 4) return n;
  const parts: string[] = [n.slice(0, 4)];
  for (let i = 4; i < n.length; i += 4) {
    parts.push(n.slice(i, i + 4));
  }
  return parts.join(' ');
}

function ibanMod97(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = '';
  for (let i = 0; i < rearranged.length; i++) {
    const c = rearranged[i];
    if (c >= '0' && c <= '9') expanded += c;
    else expanded += (c.charCodeAt(0) - 55).toString();
  }
  let remainder = 0;
  for (let i = 0; i < expanded.length; i++) {
    remainder = (remainder * 10 + parseInt(expanded[i], 10)) % 97;
  }
  return remainder === 1;
}

const TR_IBAN_REGEX = /^TR\d{24}$/;

/** Compact uppercase IBAN (no spaces). */
export function isValidTurkishIban(normalized: string): boolean {
  if (!TR_IBAN_REGEX.test(normalized)) return false;
  return ibanMod97(normalized);
}

/**
 * Strips non-IBAN characters; always uses TR + up to 24 digits (TR is implicit).
 * Paste may include or omit TR; digits-only paste is prefixed with TR.
 */
export function sanitizeTurkishIbanInput(raw: string): string {
  const compact = raw.replace(/\s/g, '').toUpperCase();
  if (compact.length === 0) return '';

  const trIdx = compact.indexOf('TR');
  let digits: string;
  if (trIdx !== -1) {
    digits = compact.slice(trIdx + 2).replace(/\D/g, '');
  } else {
    digits = compact.replace(/\D/g, '');
  }
  return ('TR' + digits).slice(0, 26);
}
