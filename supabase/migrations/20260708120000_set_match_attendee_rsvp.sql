-- Idempotent RSVP RPC: replaces client-side heal pattern in setRsvpUseCase.
--
-- Mevcut akış (race condition'a açık):
--   client: UPDATE match_attendees WHERE match_id=? AND player_id=?
--   row yoksa → NOT_FOUND → client: join_match_by_join_code RPC ile INSERT
--   tekrar UPDATE — eşzamanlı RSVP'lerde yarış: INSERT henüz commit olmamışsa
--   ikinci UPDATE 0 row → heal tekrar tetiklenir → join_code çatışmaları, kayıp
--   attendee riski.
--
-- Yeni akış (atomic):
--   tek RPC çağrısı → INSERT ... ON CONFLICT DO UPDATE
--   row varsa UPDATE, yoksa INSERT — Postgres MVCC concurrent çağrıları seri
--   olarak çözer, kayıp yok.
--
-- Auth:
--   * auth.uid() zorunlu (ERR_AUTH_REQUIRED).
--   * Kullanıcı maçı görebilmeli (organizer / mevcut attendee / team player) —
--     can_view_match() helper'ı bu kontrolü kapsar.
--   * Maç görünür değilse ERR_MATCH_NOT_FOUND atılır; gerçekten görünmeyen maç
--     ile yetkisiz erişim arasında ayrım yapmak istemiyoruz (information leak
--     önleme).
--
-- İlk INSERT row'unu kullanıcı kendisi yaratır → RLS insert policy'sini
-- bypass etmek için SECURITY DEFINER kullanılır. Normal client UPDATE yolu
-- (match_attendees_update_player) yine geçerli; bu RPC yalnızca atomic upsert
-- ihtiyacını karşılar.

CREATE OR REPLACE FUNCTION public.set_match_attendee_rsvp(
  p_match_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status public.rsvp_status;
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.raise_app_error('ERR_AUTH_REQUIRED');
  END IF;

  -- Görünürlük kontrolü: organizer / attendee / team player değilse ERR_MATCH_NOT_FOUND.
  -- can_view_match SECURITY DEFINER ile çalışır → RLS-aware ancak bypass-safe.
  IF NOT public.can_view_match(p_match_id, v_uid) THEN
    PERFORM public.raise_app_error('ERR_MATCH_NOT_FOUND');
  END IF;

  -- p_status enum kontrolü: invalid değer geçilirse Postgres invalid_text_representation
  -- atar (SQLSTATE 22P02) — mapSupabaseError generic error olarak çevirir.
  v_status := p_status::public.rsvp_status;

  INSERT INTO public.match_attendees (match_id, player_id, status, paid)
  VALUES (p_match_id, v_uid, v_status, false)
  ON CONFLICT (match_id, player_id) DO UPDATE
  SET status = EXCLUDED.status;
END;
$$;

COMMENT ON FUNCTION public.set_match_attendee_rsvp(uuid, text) IS
  'Idempotent RSVP upsert; replaces client-side heal pattern in setRsvpUseCase.';

REVOKE ALL ON FUNCTION public.set_match_attendee_rsvp(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_match_attendee_rsvp(uuid, text) TO authenticated;
