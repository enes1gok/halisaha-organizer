import { resolveColorScheme } from '../ThemeContext';

describe('resolveColorScheme', () => {
  it('uses system light when preference is "system" and OS is light', () => {
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  it('uses system dark when preference is "system" and OS is dark', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when preference is "system" and OS scheme is null', () => {
    expect(resolveColorScheme('system', null)).toBe('dark');
  });

  it('falls back to dark when preference is "system" and OS scheme is undefined', () => {
    expect(resolveColorScheme('system', undefined)).toBe('dark');
  });

  it('returns "light" when preference is "light" regardless of OS', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('light', 'light')).toBe('light');
    expect(resolveColorScheme('light', null)).toBe('light');
  });

  it('returns "dark" when preference is "dark" regardless of OS', () => {
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('dark', 'dark')).toBe('dark');
    expect(resolveColorScheme('dark', null)).toBe('dark');
  });
});
