---
name: type-check
description: TypeScript tip kontrolü çalıştır ve hataları özetle — commit öncesi gate
---

# TypeScript Tip Kontrolü

Commit veya PR öncesi çalıştır.

## Çalıştır

```bash
npx tsc --noEmit
```

## Hata Analizi

Çıktıdaki hataları şu öncelikte ele al:

1. **`any` kullanımı** — `src/types/domain.ts` veya ilgili tiplerle değiştir
2. **Eksik union case** — `assertNever(x)` ekle
3. **`undefined` olabilir** — optional chaining (`?.`) veya guard ekle
4. **Import hatası** — barrel export (`src/store/index.ts`) üzerinden import et

## Sık Görülen Hatalar ve Çözümler

| Hata | Çözüm |
|------|-------|
| `Object is possibly 'undefined'` | Guard ekle veya `!` assert kullan (emin isen) |
| `Type 'string' is not assignable to type '...'` | Domain enum'ı kullan (`src/types/domain.ts`) |
| `Property '...' does not exist` | Interface'i güncelle veya doğru tipi kullan |
| `useShallow` import hatası | `import { useShallow } from 'zustand/react/shallow'` |

## Commit Öncesi Kontrol Listesi

```
- [ ] npx tsc --noEmit → 0 hata
- [ ] npm run lint:styles → hardcoded hex/inline style yok
- [ ] npm test → ilgili testler geçiyor
```
