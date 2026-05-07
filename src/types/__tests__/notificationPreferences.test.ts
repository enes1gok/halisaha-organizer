import {
  defaultNotificationPreferences,
  isValidQuietHourTime,
  normalizeNotificationPreferences,
} from '../notificationPreferences';

describe('normalizeNotificationPreferences', () => {
  it('returns defaults for empty / invalid input', () => {
    expect(normalizeNotificationPreferences(null)).toEqual(defaultNotificationPreferences());
    expect(normalizeNotificationPreferences(undefined)).toEqual(defaultNotificationPreferences());
    expect(normalizeNotificationPreferences({})).toEqual(defaultNotificationPreferences());
  });

  it('merges partial overrides', () => {
    const n = normalizeNotificationPreferences({
      push_enabled: false,
      types: { group_match_initial: false },
    });
    expect(n.push_enabled).toBe(false);
    expect(n.types.group_match_initial).toBe(false);
    expect(n.types.group_match_reminder).toBe(true);
    expect(n.quiet_hours.enabled).toBe(false);
  });
});

describe('isValidQuietHourTime', () => {
  it('accepts HH:MM', () => {
    expect(isValidQuietHourTime('22:30')).toBe(true);
    expect(isValidQuietHourTime('07:00')).toBe(true);
    expect(isValidQuietHourTime('00:00')).toBe(true);
  });

  it('rejects invalid', () => {
    expect(isValidQuietHourTime('25:00')).toBe(false);
    expect(isValidQuietHourTime('12:60')).toBe(false);
    expect(isValidQuietHourTime('bad')).toBe(false);
  });
});
