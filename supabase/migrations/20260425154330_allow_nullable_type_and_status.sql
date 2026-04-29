alter table public.locations
  alter column type drop default;

alter table public.items
  alter column status drop default;

create or replace function public.create_location(
  loc_name text,
  loc_type text default null,
  parent_location uuid default null,
  loc_description text default null
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

  insert into public.locations (name, type, parent_id, description)
  values (
    trim(loc_name),
    nullif(trim(coalesce(loc_type, '')), ''),
    parent_location,
    nullif(trim(coalesce(loc_description, '')), '')
  )
  returning id into created_location_id;

  return created_location_id;
end;
$$;

create or replace function public.update_location(
  loc_id uuid,
  loc_name text,
  loc_type text,
  parent_location uuid default null,
  loc_description text default null
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
    description = nullif(trim(coalesce(loc_description, '')), '')
  where id = loc_id;
end;
$$;

create or replace function public.update_item_details(
  item_id uuid,
  item_name text,
  item_description text default null,
  item_value numeric default null,
  item_purchase_date date default null,
  item_status text default null
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
    status = nullif(trim(coalesce(item_status, '')), '')
  where id = item_id;
end;
$$;

grant all on function public.create_location(text, text, uuid, text) to anon;
grant all on function public.create_location(text, text, uuid, text) to authenticated;
grant all on function public.create_location(text, text, uuid, text) to service_role;

grant all on function public.update_location(uuid, text, text, uuid, text) to anon;
grant all on function public.update_location(uuid, text, text, uuid, text) to authenticated;
grant all on function public.update_location(uuid, text, text, uuid, text) to service_role;

grant all on function public.update_item_details(uuid, text, text, numeric, date, text) to anon;
grant all on function public.update_item_details(uuid, text, text, numeric, date, text) to authenticated;
grant all on function public.update_item_details(uuid, text, text, numeric, date, text) to service_role;
