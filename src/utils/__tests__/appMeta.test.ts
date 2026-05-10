import { getAppVersionDetailLines, getAppVersionLabel } from '../appMeta';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.4' },
    nativeApplicationVersion: '1.0.4',
    nativeBuildVersion: '42',
  },
}));

describe('appMeta', () => {
  it('getAppVersionLabel prefers native application version with build when distinct', () => {
    expect(getAppVersionLabel()).toBe('1.0.4 (42)');
  });

  it('getAppVersionDetailLines includes configured and native lines', () => {
    const lines = getAppVersionDetailLines();
    expect(lines.some((l) => l.includes('Yapılandırma'))).toBe(true);
    expect(lines.some((l) => l.includes('Yerel'))).toBe(true);
    expect(lines.some((l) => l.includes('Derleme'))).toBe(true);
  });
});
