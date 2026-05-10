import {
  applyMatchTemplateToFormFields,
  buildMatchTemplateFromForm,
  computeNextStartsAtForSchedule,
  formatLocalTimeFromDate,
  isoDowToJsDay,
  jsDayToIsoDow,
  parseMatchTemplateLocalTime,
} from '../matchTemplateApply';
import { normalizeStartsAtFromPicker } from '../matchStartsAtNormalize';

describe('matchTemplateApply helpers', () => {
  it('jsDayToIsoDow / isoDowToJsDay round-trip', () => {
    expect(jsDayToIsoDow(0)).toBe(7);
    expect(jsDayToIsoDow(1)).toBe(1);
    expect(jsDayToIsoDow(6)).toBe(6);
    expect(isoDowToJsDay(7)).toBe(0);
    expect(isoDowToJsDay(1)).toBe(1);
  });

  it('parseMatchTemplateLocalTime accepts HH:mm and HH:mm:ss', () => {
    expect(parseMatchTemplateLocalTime('20:30')).toEqual({ hour: 20, minute: 30 });
    expect(parseMatchTemplateLocalTime('09:05:00')).toEqual({ hour: 9, minute: 5 });
    expect(parseMatchTemplateLocalTime('invalid')).toBeNull();
  });

  it('computeNextStartsAtForSchedule picks later today when slot still ahead', () => {
    const now = new Date(2026, 4, 6, 10, 0, 0);
    const next = computeNextStartsAtForSchedule(3, { hour: 20, minute: 30 }, now);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(4);
    expect(next.getDate()).toBe(6);
    expect(next.getHours()).toBe(20);
    expect(next.getMinutes()).toBe(30);
  });

  it('computeNextStartsAtForSchedule rolls to next week when same weekday passed', () => {
    const now = new Date(2026, 4, 6, 21, 0, 0);
    const next = computeNextStartsAtForSchedule(3, { hour: 20, minute: 30 }, now);
    expect(next.getDate()).toBe(13);
    expect(next.getHours()).toBe(20);
    expect(next.getMinutes()).toBe(30);
  });

  it('formatLocalTimeFromDate matches schedule saved from picker-like Date', () => {
    const d = new Date(2026, 4, 6, 20, 30, 0);
    expect(formatLocalTimeFromDate(d)).toBe('20:30:00');
  });

  it('applyMatchTemplateToFormFields snaps schedule to half-hour grid', () => {
    const tpl = {
      id: 'x',
      name: 't',
      venue: 'Saha',
      maxPlayers: 14,
      schedule: { weekdayIsodow: 3, localTime: '20:17:00' },
      paymentMethod: 'cash' as const,
    };
    const now = new Date(2026, 4, 6, 10, 0, 0);
    const patch = applyMatchTemplateToFormFields(tpl, {
      fallbackStartsAt: new Date(2026, 4, 7, 12, 0, 0),
      now,
    });
    const normalized = normalizeStartsAtFromPicker(
      computeNextStartsAtForSchedule(3, { hour: 20, minute: 17 }, now),
    );
    expect(patch.startsAt.getTime()).toBe(normalized.getTime());
  });

  it('buildMatchTemplateFromForm rejects empty name', () => {
    const r = buildMatchTemplateFromForm({
      name: '   ',
      venue: 'X',
      maxPlayers: 14,
      selectedGroupId: null,
      startsAt: new Date(),
      paymentMethod: 'cash',
      price: '',
      profileIbanNorm: '',
      ibanFieldNorm: '',
      ibanAccountName: '',
      paymentNote: '',
      overrideIban: true,
      hasValidProfileIban: false,
    });
    expect(r.ok).toBe(false);
  });

  it('buildMatchTemplateFromForm accepts valid cash template', () => {
    const r = buildMatchTemplateFromForm({
      name: 'Akşam',
      venue: 'Kadıköy',
      maxPlayers: 12,
      selectedGroupId: null,
      startsAt: new Date(2026, 4, 6, 20, 30, 0),
      paymentMethod: 'cash',
      price: '50',
      profileIbanNorm: '',
      ibanFieldNorm: '',
      ibanAccountName: '',
      paymentNote: '',
      overrideIban: true,
      hasValidProfileIban: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.template.schedule?.weekdayIsodow).toBe(3);
      expect(r.template.pricePerPerson).toBe(50);
    }
  });
});
