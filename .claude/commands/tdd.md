---
name: tdd
description: Test-Driven Development akışı — önce test yaz, sonra implement et
---

# TDD Akışı

Yeni bir feature veya bug fix için test-first yaklaşımı uygula.

## Adımlar

### 1. Test Dosyasını Oluştur (veya bul)

- Pure logic (utils, helpers): `src/utils/__tests__/` veya `src/store/__tests__/`
- Store mutation: `src/store/__tests__/<sliceName>.test.ts`
- Domain logic: `src/domain/<domain>/__tests__/`

### 2. Failing Test Yaz

```ts
describe('<FeatureName>', () => {
  it('should <expected behavior>', () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

### 3. Test'in Fail Ettiğini Doğrula

```bash
npx jest <testFilePath> --no-coverage
```

Kırmızı görmelisin. Görmüyorsan test yanlış yazılmış.

### 4. Minimum Implementation Yap

Testi geçirecek kadar kod yaz — fazlası değil.

### 5. Test'in Geçtiğini Doğrula

```bash
npx jest <testFilePath> --no-coverage
```

Yeşil görmelisin.

### 6. Refactor Et

Test hâlâ yeşilken kodu temizle. Sonra `npm test` ile regresyon kontrolü yap.

## Bu Projede Test Matrisi

| Değişen Yer | Minimum Test |
|-------------|-------------|
| `src/utils/` | Happy path + 1 edge case |
| `src/store/helpers.ts` | State geçişleri + derived values |
| `src/domain/` | Pure logic unit tests |
| `src/store/slices/` | Mutation + selector unit tests |

## Dikkat

- Supabase çağrıları mock'la (`jest.mock('../../lib/supabase')`)
- Zustand store'u `create` ile sıfırdan başlat, global state'e bağımlı olma
- Her test kendi `beforeEach` ile temiz state ile başlasın
