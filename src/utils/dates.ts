import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function formatMatchDateTime(iso: string): string {
  try {
    return format(new Date(iso), 'd MMMM yyyy, HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM', { locale: tr });
  } catch {
    return iso;
  }
}
