# Grup silme — manuel doğrulama matrisi

PR veya sürüm öncesi aşağıdaki senaryoları işaretleyerek doğrulayın.

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Oturum açık, grup UUID, hesap grubun **yöneticisi** → Grubu kaldır | Supabase `public.groups` satırı silinir; Gruplar listesi güncellenir |
| 2 | Aynı grupta **üye** hesap (mümkünse) → Grup detayı | “Grubu kaldır” görünmez; “Gruptan ayrıl” görünür |
| 3 | Yönetici ile silme sonrası **aynı ekranda ikinci kez** deneme / çift tetik | İlk silmeden sonra navigasyon olur; gereksiz `[usecase] deleteGroup failed` uyarısı olmamalı |
| 4 | Oturum açık + **yerel grup id** (`group-…`) ile detay (sınır durum) → Grubu kaldır | **Salt yerel** temizlik; sunucuda hata beklenmez (metin ipucu: salt bu cihaz) |
| 5 | **Oturum kapalı** → yerel grup sil | Yerel store temizlenir; uzak DELETE çağrılmaz |

Ek: Silme hatasında (yetki / ağ) uygulama listeyi yenilemeyi dener (`hydrateRemoteGroups`); ardından hata iletisi gösterilir.

İlgili otomasyon: `npm test -- src/utils/__tests__/matchId.test.ts src/usecases/__tests__/groups.delete.test.ts`
