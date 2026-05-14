-- Fix: migration 20260623120000_payment_reminder_expansion was recorded as applied
-- on the remote project but the DDL never executed, leaving payment_method as TEXT
-- and the match_payment_method enum type absent.
-- This migration is idempotent: safe to run on both affected and unaffected databases.

do $$
declare
  col_type text;
begin
  -- Resolve actual column type from information_schema
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'matches'
    and column_name  = 'payment_method';

  -- 1. Create enum type if absent
  if not exists (
    select 1 from pg_type
    where typname = 'match_payment_method'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.match_payment_method as enum ('note_only', 'iban', 'cash');
  end if;

  -- 2. Convert column only when it is still stored as text
  if col_type = 'text' then
    alter table public.matches
      drop constraint if exists matches_payment_method_chk,
      drop constraint if exists matches_payment_note_chk;

    alter table public.matches
      alter column payment_method drop default,
      alter column payment_method type public.match_payment_method
        using payment_method::public.match_payment_method,
      alter column payment_method set default 'iban'::public.match_payment_method;

    alter table public.matches
      add constraint matches_payment_note_chk
      check (
        (
          payment_method = 'note_only'::public.match_payment_method
          and char_length(trim(coalesce(payment_note, ''))) between 1 and 120
          and iban is null
          and iban_account_name is null
        )
        or
        (
          payment_method <> 'note_only'::public.match_payment_method
          and payment_note is null
        )
      );
  end if;
end $$;
