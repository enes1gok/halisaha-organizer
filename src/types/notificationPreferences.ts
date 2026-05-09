/** Mirrors `profiles.notification_preferences` JSON (Supabase). */

export type NotificationPreferences = {
  push_enabled: boolean;
  types: {
    group_match_initial: boolean;
    group_match_reminder: boolean;
    group_match_cancelled: boolean;
    group_match_venue_change: boolean;
    group_match_lineup_published: boolean;
    group_match_payment_reminder: boolean;
    group_match_post_match_rating_reminder: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
};

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    push_enabled: true,
    types: {
      group_match_initial: true,
      group_match_reminder: true,
      group_match_cancelled: true,
      group_match_venue_change: true,
      group_match_lineup_published: true,
      group_match_payment_reminder: true,
      group_match_post_match_rating_reminder: true,
    },
    quiet_hours: {
      enabled: false,
      start: '22:30',
      end: '07:00',
      timezone: 'Europe/Istanbul',
    },
  };
}

/** Merge DB jsonb (possibly partial / empty) with defaults — same semantics as SQL helpers. */
export function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const base = defaultNotificationPreferences();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;

  const typesIn = o.types && typeof o.types === 'object' && !Array.isArray(o.types)
    ? (o.types as Record<string, unknown>)
    : {};
  const qhIn =
    o.quiet_hours && typeof o.quiet_hours === 'object' && !Array.isArray(o.quiet_hours)
      ? (o.quiet_hours as Record<string, unknown>)
      : {};

  return {
    push_enabled:
      typeof o.push_enabled === 'boolean' ? o.push_enabled : base.push_enabled,
    types: {
      group_match_initial:
        typeof typesIn.group_match_initial === 'boolean'
          ? typesIn.group_match_initial
          : base.types.group_match_initial,
      group_match_reminder:
        typeof typesIn.group_match_reminder === 'boolean'
          ? typesIn.group_match_reminder
          : base.types.group_match_reminder,
      group_match_cancelled:
        typeof typesIn.group_match_cancelled === 'boolean'
          ? typesIn.group_match_cancelled
          : base.types.group_match_cancelled,
      group_match_venue_change:
        typeof typesIn.group_match_venue_change === 'boolean'
          ? typesIn.group_match_venue_change
          : base.types.group_match_venue_change,
      group_match_lineup_published:
        typeof typesIn.group_match_lineup_published === 'boolean'
          ? typesIn.group_match_lineup_published
          : base.types.group_match_lineup_published,
      group_match_payment_reminder:
        typeof typesIn.group_match_payment_reminder === 'boolean'
          ? typesIn.group_match_payment_reminder
          : base.types.group_match_payment_reminder,
      group_match_post_match_rating_reminder:
        typeof typesIn.group_match_post_match_rating_reminder === 'boolean'
          ? typesIn.group_match_post_match_rating_reminder
          : base.types.group_match_post_match_rating_reminder,
    },
    quiet_hours: {
      enabled:
        typeof qhIn.enabled === 'boolean' ? qhIn.enabled : base.quiet_hours.enabled,
      start: typeof qhIn.start === 'string' && qhIn.start.trim() ? qhIn.start.trim() : base.quiet_hours.start,
      end: typeof qhIn.end === 'string' && qhIn.end.trim() ? qhIn.end.trim() : base.quiet_hours.end,
      timezone:
        typeof qhIn.timezone === 'string' && qhIn.timezone.trim()
          ? qhIn.timezone.trim()
          : base.quiet_hours.timezone,
    },
  };
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidQuietHourTime(s: string): boolean {
  return HHMM.test(s.trim());
}
