create or replace function public.update_location_details(
  loc_id uuid,
  loc_name text,
  loc_type text,
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

  if trim(coalesce(loc_type, '')) = '' then
    raise exception 'Location type is required';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = loc_id
  ) then
    raise exception 'Location does not exist';
  end if;

  update public.locations
  set
    name = trim(loc_name),
    type = trim(loc_type),
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

grant all on function public.update_location_details(uuid, text, text, text) to anon;
grant all on function public.update_location_details(uuid, text, text, text) to authenticated;
grant all on function public.update_location_details(uuid, text, text, text) to service_role;

grant all on function public.update_item_details(uuid, text, text, numeric, date, text) to anon;
grant all on function public.update_item_details(uuid, text, text, numeric, date, text) to authenticated;
grant all on function public.update_item_details(uuid, text, text, numeric, date, text) to service_role;
