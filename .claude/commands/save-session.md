---
name: save-session
description: Mevcut çalışma oturumunun özetini .claude/sessions/ klasörüne kaydet
---

# Oturum Kaydet

Bu konuşmada yapılan değişikliklerin özetini kalıcı hafızaya kaydet.

## Kaydet

Aşağıdaki bilgileri `.claude/sessions/YYYY-MM-DD.md` dosyasına yaz:

```markdown
# Session — <tarih>

## Yapılanlar
- <değişiklik 1>
- <değişiklik 2>

## Değiştirilen Dosyalar
- <dosya path'leri>

## Açık Konular / Sonraki Adımlar
- <varsa bekleyen iş>

## Önemli Kararlar
- <alınan mimari/tasarım kararları>
```

## Kullanım

Bu komutu çalıştır → Claude mevcut konuşmayı özetler ve `.claude/sessions/<tarih>.md`'ye yazar.

Sonraki oturumda: "Önceki oturumu hatırlıyor musun?" diye sor veya dosyayı oku.

## Otomatik Log

Her oturum sonunda `.claude/sessions/log.md` dosyasına tek satırlık özet eklenir (Stop hook tarafından otomatik).
