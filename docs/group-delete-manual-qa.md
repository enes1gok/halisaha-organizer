# Grup silme — manuel doğrulama matrisi

PR veya sürüm öncesi aşağıdaki senaryoları işaretleyerek doğrulayın.

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Oturum açık, grup UUID, hesap grubun **yöneticisi** → Grubu kaldır | `delete_group` RPC başarılı; `public.groups` satırı silinir; Gruplar listesi güncellenir (hata yoksa `ERR_*` görünmez) |
| 2 | Aynı grupta **üye** hesap (mümkünse) → Grup detayı | “Grubu kaldır” görünmez; “Gruptan ayrıl” görünür |
| 3 | Yönetici ile silme sonrası **aynı ekranda ikinci kez** deneme / çift tetik | İlk silmeden sonra navigasyon olur; ikinci denemede RPC `ERR_GROUP_NOT_FOUND` (veya ekran zaten kapandıysa tetiklenmez); gereksiz `[usecase] deleteGroup failed` uyarısı olmamalı |
| 4 | Oturum açık + **yerel grup id** (`group-…`) ile detay (sınır durum) → Grubu kaldır | **Salt yerel** temizlik; sunucuda hata beklenmez (metin ipucu: salt bu cihaz) |
| 5 | **Oturum kapalı** → yerel grup sil | Yerel store temizlenir; uzak `delete_group` RPC çağrılmaz |
| 6 | RPC uzakta yok (PGRST202 simülasyonu — migration deploy edilmemiş) | Kullanıcıya “Sunucu sürümü güncel değil…” mesajı; **Teknik detay → Kopyala** çıktısında `errToken: ERR_BACKEND_SCHEMA_OUTDATED`, `rpcName: delete_group`, `pgCode: PGRST202`. Çözüm: [group-delete-db-verify.md §5](./group-delete-db-verify.md). |

Ek: Silme hatasında (yetki / ağ) uygulama listeyi yenilemeyi dener (`hydrateRemoteGroups`); ardından `showUserFacingErrorAlert` ile mesaj + isteğe bağlı **Teknik detay** (traceId, `ERR_*`) gösterilir.

İlgili otomasyon: `npm test -- src/utils/__tests__/matchId.test.ts src/usecases/__tests__/groups.delete.test.ts`
