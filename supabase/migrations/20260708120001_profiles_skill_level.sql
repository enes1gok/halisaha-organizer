-- Oyuncu yetenek seviyesi — kullanıcının kendi beyan ettiği 1–10 skala.
-- Peer rating (match_peer_ratings) ile farklı: maç sonu oylama değil,
-- kendi beyan ettiği yetenek. Lineup Dengele algoritmasında peer rating
-- yokken fallback olarak kullanılır (skillLevel × 10 → 0–100 ölçeğine map).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_level SMALLINT DEFAULT NULL
  CONSTRAINT profiles_skill_level_chk CHECK (skill_level BETWEEN 1 AND 10);

COMMENT ON COLUMN public.profiles.skill_level IS
  '1–10 kullanıcı beyan yetenek seviyesi. NULL = belirtilmemiş. '
  'Lineup balance: peer rating yoksa fallback (skillLevel × 10).';
