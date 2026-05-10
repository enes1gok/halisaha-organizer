import { appendPhotoUriCacheBuster, stripUrlQueryForStorage } from '../photoUri';

describe('photoUri', () => {
  it('stripUrlQueryForStorage removes query string', () => {
    expect(stripUrlQueryForStorage('https://x.test/a/b.jpg?v=1')).toBe('https://x.test/a/b.jpg');
  });

  it('appendPhotoUriCacheBuster adds v param from clean base', () => {
    expect(appendPhotoUriCacheBuster('https://x.test/a.jpg', '2026-01-01')).toBe(
      'https://x.test/a.jpg?v=2026-01-01',
    );
  });

  it('appendPhotoUriCacheBuster strips stale query then applies version', () => {
    expect(appendPhotoUriCacheBuster('https://x.test/a.jpg?foo=1', 'abc')).toBe(
      'https://x.test/a.jpg?v=abc',
    );
  });
});
