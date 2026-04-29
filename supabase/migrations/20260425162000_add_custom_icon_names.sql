alter table public.locations
  add column if not exists icon_name text;

alter table public.items
  add column if not exists icon_name text;

drop function if exists public.create_location(text, text, uuid, text);
create function public.create_location(
  loc_name text,
  loc_type text default null,
  parent_location uuid default null,
  loc_description text default null,
  loc_icon_name text default null
)
returns uuid
language plpgsql
as $$
declare
  created_location_id uuid;
begin
  if trim(coalesce(loc_name, '')) = '' then
    raise exception 'Location name is required';
  end if;

  if parent_location is not null and not exists (
    select 1
    from public.locations
    where id = parent_location
  ) then
    raise exception 'Parent location does not exist';
  end if;

  insert into public.locations (name, type, parent_id, description, icon_name)
  values (
    trim(loc_name),
    nullif(trim(coalesce(loc_type, '')), ''),
    parent_location,
    nullif(trim(coalesce(loc_description, '')), ''),
    nullif(trim(coalesce(loc_icon_name, '')), '')
  )
  returning id into created_location_id;

  return created_location_id;
end;
$$;

drop function if exists public.update_location(uuid, text, text, uuid, text);
create function public.update_location(
  loc_id uuid,
  loc_name text,
  loc_type text,
  parent_location uuid default null,
  loc_description text default null,
  loc_icon_name text default null
)
returns void
language plpgsql
as $$
begin
  if loc_id is null then
    raise exception 'Location id is required';
  end if;

  if trim(coalesce(loc_name, '')) = '' then
    raise exception 'Location name is required';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = loc_id
  ) then
    raise exception 'Location does not exist';
  end if;

  if parent_location = loc_id then
    raise exception 'Cannot move location into itself';
  end if;

  if parent_location is not null and not exists (
    select 1
    from public.locations
    where id = parent_location
  ) then
    raise exception 'Parent location does not exist';
  end if;

  perform public.move_location(loc_id, parent_location);

  update public.locations
  set
    name = trim(loc_name),
    type = nullif(trim(coalesce(loc_type, '')), ''),
    description = nullif(trim(coalesce(loc_description, '')), ''),
    icon_name = nullif(trim(coalesce(loc_icon_name, '')), '')
  where id = loc_id;
end;
$$;

drop function if exists public.create_item(text, uuid);
create function public.create_item(
  item_name text,
  target_location uuid,
  item_icon_name text default null
)
returns uuid
language plpgsql
as $$
declare
  created_item_id uuid;
begin
  if trim(coalesce(item_name, '')) = '' then
    raise exception 'Item name is required';
  end if;

  if target_location is null then
    raise exception 'Items must belong to a location';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = target_location
  ) then
    raise exception 'Target location does not exist';
  end if;

  insert into public.items (name, location_id, icon_name)
  values (
    trim(item_name),
    target_location,
    nullif(trim(coalesce(item_icon_name, '')), '')
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

drop function if exists public.update_item_details(uuid, text, text, numeric, date, text);
create function public.update_item_details(
  item_id uuid,
  item_name text,
  item_description text default null,
  item_value numeric default null,
  item_purchase_date date default null,
  item_status text default null,
  item_icon_name text default null
)
returns void
language plpgsql
as $$
begin
  if item_id is null then
    raise exception 'Item id is required';
  end if;

  if trim(coalesce(item_name, '')) = '' then
    raise exception 'Item name is required';
  end if;

  if not exists (
    select 1
    from public.items
    where id = item_id
  ) then
    raise exception 'Item does not exist';
  end if;

  update public.items
  set
    name = trim(item_name),
    description = nullif(trim(coalesce(item_description, '')), ''),
    value = item_value,
    purchase_date = item_purchase_date,
    status = nullif(trim(coalesce(item_status, '')), ''),
    icon_name = nullif(trim(coalesce(item_icon_name, '')), '')
  where id = item_id;
end;
$$;

grant all on function public.create_location(text, text, uuid, text, text) to anon;
grant all on function public.create_location(text, text, uuid, text, text) to authenticated;
grant all on function public.create_location(text, text, uuid, text, text) to service_role;

grant all on function public.update_location(uuid, text, text, uuid, text, text) to anon;
grant all on function public.update_location(uuid, text, text, uuid, text, text) to authenticated;
grant all on function public.update_location(uuid, text, text, uuid, text, text) to service_role;

grant all on function public.create_item(text, uuid, text) to anon;
grant all on function public.create_item(text, uuid, text) to authenticated;
grant all on function public.create_item(text, uuid, text) to service_role;

grant all on function public.update_item_details(uuid, text, text, numeric, date, text, text) to anon;
grant all on function public.update_item_details(uuid, text, text, numeric, date, text, text) to authenticated;
grant all on function public.update_item_details(uuid, text, text, numeric, date, text, text) to service_role;
