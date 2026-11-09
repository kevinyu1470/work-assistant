create or replace function public.kansai_trip_asset_in_history(room_hash text, asset_id text)
returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from kansai_private.trip_versions v
 cross join lateral jsonb_each_text(v.doc->'settings') s
 where v.room_id=room_hash and s.key like 'voucher\_%' escape '\'
 and strpos(s.value,asset_id)>0);
$$;
revoke all on function public.kansai_trip_asset_in_history(text,text) from public, anon, authenticated;
grant execute on function public.kansai_trip_asset_in_history(text,text) to service_role;
