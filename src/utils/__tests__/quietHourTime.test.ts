import { formatDateToQuietHour, parseQuietHourToDate } from '../quietHourTime';

describe('quietHourTime', () => {
  const base = new Date('2026-05-10T12:00:00');

  it('formats local hours and minutes with zero padding', () => {
    const d = new Date(base);
    d.setHours(9, 5, 0, 0);
    expect(formatDateToQuietHour(d)).toBe('09:05');
    d.setHours(23, 59, 0, 0);
    expect(formatDateToQuietHour(d)).toBe('23:59');
  });

  it('parses HH:MM onto the base calendar day', () => {
    const d = parseQuietHourToDate('22:30', base);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(22);
    expect(d.getMinutes()).toBe(30);
  });

  it('round-trips through format', () => {
    const d = parseQuietHourToDate('07:00', base);
    expect(formatDateToQuietHour(d)).toBe('07:00');
  });
});
