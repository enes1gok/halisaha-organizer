begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

-- Maç + organizer + bir mevcut attendee (participant) seed.
insert into public.matches (id, starts_at, venue, organizer_id, join_code)
values (
  'b0000000-0000-4000-8000-000000000040'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHRSVP40'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_participant(), 'going', false),
  ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_organizer(), 'going', false);

-- 1) Anonim çağrı → ERR_AUTH_REQUIRED
select tests.reset_session();
select throws_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'maybe'
     ) $$,
  'P0001',
  'ERR_AUTH_REQUIRED',
  'anonim cagri ERR_AUTH_REQUIRED atar'
);

-- 2) Mevcut attendee (participant) status değişimi: going → maybe
select tests.authenticate_as(tests.uuid_participant());
select lives_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'maybe'
     ) $$,
  'participant kendi RSVP statusunu degistirir (UPDATE yolu)'
);
select is(
  (select status::text from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
     and player_id = tests.uuid_participant()),
  'maybe',
  'participant status maybe oldu'
);

-- 3) Aynı çağrı tekrar → idempotent (UPDATE yine maybe)
select lives_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'maybe'
     ) $$,
  'idempotent: ikinci cagri ayni status icin sorunsuz'
);
select is(
  (select count(*)::int from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
     and player_id = tests.uuid_participant()),
  1,
  'idempotent: row sayisi 1 (cift INSERT yok)'
);

-- 4) Non-member kullanıcı → maç görünür değil → ERR_MATCH_NOT_FOUND
select tests.authenticate_as(tests.uuid_non_member());
select throws_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'going'
     ) $$,
  'P0001',
  'ERR_MATCH_NOT_FOUND',
  'goremedigi mac icin ERR_MATCH_NOT_FOUND'
);

-- 5) Non-member: organizer onu attendee olarak ekleyince artık görebilir → INSERT yolu
select tests.authenticate_as(tests.uuid_organizer());
insert into public.match_attendees (match_id, player_id, status, paid)
values ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_non_member(), 'going', false);

-- Şimdi non_member kendi attendee row'unu direkt RPC ile maybe yapsın
select tests.authenticate_as(tests.uuid_non_member());
select lives_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'maybe'
     ) $$,
  'organizer ekledikten sonra non_member kendi RSVP statusunu degistirir'
);
select is(
  (select status::text from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
     and player_id = tests.uuid_non_member()),
  'maybe',
  'eklenen non_member status maybe oldu'
);

-- 6) Geçersiz status değeri → 22P02 (invalid_text_representation)
select tests.authenticate_as(tests.uuid_participant());
select throws_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'banana'
     ) $$,
  '22P02',
  null,
  'gecersiz enum string 22P02 atar'
);

-- 7) Görünmeyen maç (sahte UUID) → ERR_MATCH_NOT_FOUND
select throws_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-0000000fffff'::uuid,
       'going'
     ) $$,
  'P0001',
  'ERR_MATCH_NOT_FOUND',
  'bilinmeyen mac icin ERR_MATCH_NOT_FOUND'
);

-- 11-12) not_going status'u da geçerli enum değeridir
select tests.authenticate_as(tests.uuid_participant());
select lives_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'not_going'
     ) $$,
  'not_going gecerli enum, hata vermez'
);
select is(
  (select status::text from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
     and player_id = tests.uuid_participant()),
  'not_going',
  'participant status not_going oldu'
);

-- 13-14) not_going → going geri dönüşü mümkün (tüm geçişler serbest)
select lives_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'going'
     ) $$,
  'not_going dan going a geri donulebilir'
);
select is(
  (select status::text from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
     and player_id = tests.uuid_participant()),
  'going',
  'participant status going e dondu'
);

-- 15-16) Organizer kendi RSVP'sini RPC ile değiştirebilir
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ select public.set_match_attendee_rsvp(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       'maybe'
     ) $$,
  'organizer kendi RSVP statusunu degistirir'
);
select is(
  (select status::text from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
     and player_id = tests.uuid_organizer()),
  'maybe',
  'organizer status maybe oldu'
);

select * from finish();

rollback;
