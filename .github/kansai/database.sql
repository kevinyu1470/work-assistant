-- Private, transactional recovery copies. No shared-link secrets or travel data in source.
create schema if not exists kansai_private;
revoke all on schema kansai_private from public, anon, authenticated;
grant usage on schema kansai_private to service_role;
create table if not exists kansai_private.trip_versions (
 room_id text not null,
 revision integer not null check (revision > 0),
 doc jsonb not null,
 captured_at timestamptz not null default now(),
 operation text not null,
 primary key(room_id, revision)
);
alter table kansai_private.trip_versions enable row level security;
revoke all on kansai_private.trip_versions from public, anon, authenticated;
grant select, insert on kansai_private.trip_versions to service_role;
insert into kansai_private.trip_versions(room_id,revision,doc,captured_at,operation)
 select id,revision,doc,updated_at,'baseline' from public.kansai_trip_rooms on conflict do nothing;
create or replace function kansai_private.guard_trip_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.id <> old.id or new.revision <> old.revision + 1 then
  raise exception 'trip_revision_must_advance_once' using errcode = '40001';
 end if;
 new.updated_at := clock_timestamp();
 new.doc := jsonb_set(new.doc, '{updatedAt}', to_jsonb(new.updated_at));
 return new;
end; $$;
create or replace function kansai_private.capture_trip_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op <> 'INSERT' then
  insert into kansai_private.trip_versions(room_id,revision,doc,captured_at,operation)
  values(old.id,old.revision,old.doc,old.updated_at,lower(tg_op)) on conflict do nothing;
 end if;
 if tg_op <> 'DELETE' then
  insert into kansai_private.trip_versions(room_id,revision,doc,captured_at,operation)
  values(new.id,new.revision,new.doc,new.updated_at,lower(tg_op)) on conflict do nothing;
  return new;
 end if;
 return old;
end; $$;
revoke all on function kansai_private.guard_trip_revision() from public, anon, authenticated;
revoke all on function kansai_private.capture_trip_version() from public, anon, authenticated;
create trigger guard_trip_revision before update on public.kansai_trip_rooms
 for each row execute function kansai_private.guard_trip_revision();
create trigger capture_trip_version after insert or update or delete on public.kansai_trip_rooms
 for each row execute function kansai_private.capture_trip_version();
alter table public.kansai_trip_rooms add constraint kansai_doc_shape check ((
 jsonb_typeof(doc) = 'object' and doc->>'version' = '1' and
 jsonb_typeof(doc->'events') = 'array' and jsonb_typeof(doc->'tripDays') = 'array' and
 jsonb_typeof(doc->'checklist') = 'array' and jsonb_typeof(doc->'settings') = 'object' and
 jsonb_typeof(doc->'days') = 'object' and jsonb_typeof(doc->'travelNotes') = 'array' and
 jsonb_array_length(doc->'tripDays') between 1 and 366 and jsonb_array_length(doc->'events') <= 1000
 ) is true);
-- Service-only RPC: private schema remains outside the public Data API.
create or replace function public.kansai_trip_history(room_hash text, wanted_revision integer default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select case when wanted_revision is not null then
  (select jsonb_build_object('state',doc,'revision',revision,'updatedAt',captured_at)
   from kansai_private.trip_versions where room_id=room_hash and revision=wanted_revision)
 else jsonb_build_object('versions',coalesce((select jsonb_agg(v order by revision desc) from (
  select revision,captured_at as "updatedAt",jsonb_array_length(doc->'events') as "eventCount",operation
  from kansai_private.trip_versions where room_id=room_hash order by revision desc limit 30
 )v),'[]'::jsonb)) end;
$$;
revoke all on function public.kansai_trip_history(text,integer) from public, anon, authenticated;
grant execute on function public.kansai_trip_history(text,integer) to service_role;

-- Applied separately after the version-history migration.
revoke delete, truncate on public.kansai_trip_rooms from service_role;
