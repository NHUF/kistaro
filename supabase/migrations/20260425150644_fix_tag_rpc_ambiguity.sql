drop function if exists public.attach_item_tag(uuid, text);

create or replace function public.attach_item_tag(
  target_item_id uuid,
  tag_name text
)
returns uuid
language plpgsql
as $$
declare
  resolved_tag_id uuid;
begin
  if target_item_id is null then
    raise exception 'Item id is required';
  end if;

  if not exists (
    select 1
    from public.items
    where id = target_item_id
  ) then
    raise exception 'Item does not exist';
  end if;

  resolved_tag_id := public.find_or_create_tag(tag_name);

  insert into public.item_tags (item_id, tag_id)
  values (target_item_id, resolved_tag_id)
  on conflict (item_id, tag_id) do nothing;

  return resolved_tag_id;
end;
$$;

drop function if exists public.detach_item_tag(uuid, uuid);

create or replace function public.detach_item_tag(
  target_item_id uuid,
  target_tag_id uuid
)
returns void
language plpgsql
as $$
begin
  if target_item_id is null or target_tag_id is null then
    raise exception 'Item id and tag id are required';
  end if;

  delete from public.item_tags
  where public.item_tags.item_id = target_item_id
    and public.item_tags.tag_id = target_tag_id;
end;
$$;

drop function if exists public.attach_location_tag(uuid, text);

create or replace function public.attach_location_tag(
  target_location_id uuid,
  tag_name text
)
returns uuid
language plpgsql
as $$
declare
  resolved_tag_id uuid;
begin
  if target_location_id is null then
    raise exception 'Location id is required';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = target_location_id
  ) then
    raise exception 'Location does not exist';
  end if;

  resolved_tag_id := public.find_or_create_tag(tag_name);

  insert into public.location_tags (location_id, tag_id)
  values (target_location_id, resolved_tag_id)
  on conflict (location_id, tag_id) do nothing;

  return resolved_tag_id;
end;
$$;

drop function if exists public.detach_location_tag(uuid, uuid);

create or replace function public.detach_location_tag(
  target_location_id uuid,
  target_tag_id uuid
)
returns void
language plpgsql
as $$
begin
  if target_location_id is null or target_tag_id is null then
    raise exception 'Location id and tag id are required';
  end if;

  delete from public.location_tags
  where public.location_tags.location_id = target_location_id
    and public.location_tags.tag_id = target_tag_id;
end;
$$;

grant all on function public.attach_item_tag(uuid, text) to anon;
grant all on function public.attach_item_tag(uuid, text) to authenticated;
grant all on function public.attach_item_tag(uuid, text) to service_role;

grant all on function public.detach_item_tag(uuid, uuid) to anon;
grant all on function public.detach_item_tag(uuid, uuid) to authenticated;
grant all on function public.detach_item_tag(uuid, uuid) to service_role;

grant all on function public.attach_location_tag(uuid, text) to anon;
grant all on function public.attach_location_tag(uuid, text) to authenticated;
grant all on function public.attach_location_tag(uuid, text) to service_role;

grant all on function public.detach_location_tag(uuid, uuid) to anon;
grant all on function public.detach_location_tag(uuid, uuid) to authenticated;
grant all on function public.detach_location_tag(uuid, uuid) to service_role;
