-- Append-only audit trail for critical tables (ops / service_role / dashboard SQL only).
-- Retention: archive or purge rows older than policy via scheduled job (not automated here).

create schema if not exists audit;

create table if not exists audit.row_changes (
  id bigserial primary key,
  table_name text not null,
  record_id uuid not null,
  op text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  changed_at timestamptz not null default now(),
  actor_id uuid,
  old_data jsonb,
  new_data jsonb
);

comment on table audit.row_changes is
  'Row-level change log; IBAN fields redacted. Readable via service_role or direct DB admin — not exposed to anon/authenticated.';

alter table audit.row_changes enable row level security;

revoke all on schema audit from public;
revoke all on table audit.row_changes from public;

revoke all on schema audit from anon;
revoke all on table audit.row_changes from anon;

-- authenticated may reference the table; RLS (no policies) yields zero visible rows.
grant usage on schema audit to postgres, service_role, authenticated;
grant select on table audit.row_changes to postgres, service_role, authenticated;

-- Trigger writer runs as definer (postgres); inserts bypass RLS for owner in typical setups.

create or replace function audit.append_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
  v_op text;
begin
  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_id := new.id;
    v_op := 'INSERT';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id := new.id;
    v_op := 'UPDATE';
  else
    v_old := to_jsonb(old);
    v_new := null;
    v_id := old.id;
    v_op := 'DELETE';
  end if;

  if v_old is not null and v_old ? 'iban' then
    v_old := v_old - 'iban';
  end if;
  if v_new is not null and v_new ? 'iban' then
    v_new := v_new - 'iban' || jsonb_build_object('iban', to_jsonb('[REDACTED]'::text));
  end if;

  insert into audit.row_changes (table_name, record_id, op, actor_id, old_data, new_data)
  values (tg_table_name::text, v_id, v_op, auth.uid(), v_old, v_new);

  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_audit_row_change on public.profiles;

create trigger profiles_audit_row_change
after insert or update or delete on public.profiles
for each row
execute procedure audit.append_row_change();

drop trigger if exists matches_audit_row_change on public.matches;

create trigger matches_audit_row_change
after insert or update or delete on public.matches
for each row
execute procedure audit.append_row_change();
