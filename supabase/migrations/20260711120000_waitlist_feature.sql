-- Waitlist feature:
--   1. rsvp_status enum'a 'waitlisted' değeri ekle
--   2. match_attendees tablosuna waitlisted_at kolon ekle
--   3. can_view_match fonksiyonunu grup üyelerini kapsayacak şekilde güncelle
--   4. join_match_waitlist RPC — dolu maçlara yedek olarak kaydol
--   5. promote_first_waitlisted trigger — birisi going'den vazgeçince ilk yedek kadroya alınır
--
-- ERR tokens: ERR_MATCH_ROSTER_NOT_FULL

-- ── 1. rsvp_status enum genişlet ─────────────────────────────────────────────

ALTER TYPE public.rsvp_status ADD VALUE IF NOT EXISTS 'waitlisted';

-- ── 2. match_attendees: waitlisted_at kolon ──────────────────────────────────

ALTER TABLE public.match_attendees
  ADD COLUMN IF NOT EXISTS waitlisted_at timestamptz;

-- ── 3. can_view_match: grup üyelerini ekle ───────────────────────────────────
-- Grup üyesi olup henüz katılmamış biri, grubun maçını görüntüleyebilmeli.

CREATE OR REPLACE FUNCTION public.can_view_match(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        m.organizer_id = p_uid
        OR EXISTS (
          SELECT 1 FROM public.match_attendees a
          WHERE a.match_id = m.id AND a.player_id = p_uid
        )
        OR EXISTS (
          SELECT 1 FROM public.match_team_players t
          WHERE t.match_id = m.id AND t.player_id = p_uid
        )
        OR (
          m.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = m.group_id AND gm.player_id = p_uid
          )
        )
      )
  );
$$;

-- ── 4. join_match_waitlist RPC ────────────────────────────────────────────────
-- Kullanıcıyı dolu bir maçın yedek listesine ekler.
-- Maç dolu değilse ERR_MATCH_ROSTER_NOT_FULL atar — normal RSVP kullanılmalı.

CREATE OR REPLACE FUNCTION public.join_match_waitlist(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_going int;
  v_max   int;
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.raise_app_error('ERR_AUTH_REQUIRED');
  END IF;

  IF NOT public.can_view_match(p_match_id, v_uid) THEN
    PERFORM public.raise_app_error('ERR_MATCH_NOT_FOUND');
  END IF;

  SELECT count(*) INTO v_going
  FROM public.match_attendees
  WHERE match_id = p_match_id
    AND status = 'going'::public.rsvp_status;

  SELECT max_players INTO v_max
  FROM public.matches
  WHERE id = p_match_id;

  IF v_max IS NULL THEN
    PERFORM public.raise_app_error('ERR_MATCH_NOT_FOUND');
  END IF;

  IF v_going < v_max THEN
    PERFORM public.raise_app_error('ERR_MATCH_ROSTER_NOT_FULL');
  END IF;

  INSERT INTO public.match_attendees (match_id, player_id, status, paid, waitlisted_at)
  VALUES (p_match_id, v_uid, 'waitlisted'::public.rsvp_status, false, now())
  ON CONFLICT (match_id, player_id) DO UPDATE
    SET status       = 'waitlisted'::public.rsvp_status,
        waitlisted_at = COALESCE(public.match_attendees.waitlisted_at, now());
END;
$$;

COMMENT ON FUNCTION public.join_match_waitlist(uuid) IS
  'Dolu maçlara yedek liste kaydı oluşturur. Boş yer varsa ERR_MATCH_ROSTER_NOT_FULL atar.';

REVOKE ALL ON FUNCTION public.join_match_waitlist(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.join_match_waitlist(uuid) TO authenticated;

-- ── 5. promote_first_waitlisted trigger ──────────────────────────────────────
-- Bir going katılımcı not_going veya maybe'ye geçtiğinde, yedek listesindeki
-- ilk kişiyi (en erken waitlisted_at) otomatik kadroya alır.
-- FOR UPDATE SKIP LOCKED ile eş zamanlı çift terfi önlenir.

CREATE OR REPLACE FUNCTION public.promote_first_waitlisted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_going int;
  v_max   int;
  v_next  uuid;
BEGIN
  -- Sadece going → başka durum geçişinde tetikle
  IF OLD.status <> 'going'::public.rsvp_status THEN RETURN NEW; END IF;
  IF NEW.status = 'going'::public.rsvp_status THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_going
  FROM public.match_attendees
  WHERE match_id = NEW.match_id
    AND status = 'going'::public.rsvp_status;

  SELECT max_players INTO v_max
  FROM public.matches
  WHERE id = NEW.match_id;

  -- Hâlâ dolu veya max bilinmiyorsa yedek almaya gerek yok
  IF v_max IS NULL OR v_going >= v_max THEN RETURN NEW; END IF;

  SELECT player_id INTO v_next
  FROM public.match_attendees
  WHERE match_id = NEW.match_id
    AND status = 'waitlisted'::public.rsvp_status
  ORDER BY waitlisted_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_next IS NOT NULL THEN
    UPDATE public.match_attendees
    SET status       = 'going'::public.rsvp_status,
        waitlisted_at = NULL
    WHERE match_id = NEW.match_id
      AND player_id = v_next;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_attendees_promote_waitlist ON public.match_attendees;

CREATE TRIGGER match_attendees_promote_waitlist
  AFTER UPDATE OF status
  ON public.match_attendees
  FOR EACH ROW
  EXECUTE PROCEDURE public.promote_first_waitlisted();
