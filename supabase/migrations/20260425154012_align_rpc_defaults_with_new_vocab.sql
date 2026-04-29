create or replace function public.create_location(
  loc_name text,
  loc_type text default 'undefined',
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

  if trim(coalesce(loc_type, '')) = '' then
    raise exception 'Location type is required';
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
    trim(loc_type),
    parent_location,
    nullif(trim(coalesce(loc_description, '')), '')
  )
  returning id into created_location_id;

  return created_location_id;
end;
$$;

grant all on function public.create_location(text, text, uuid, text) to anon;
grant all on function public.create_location(text, text, uuid, text) to authenticated;
grant all on function public.create_location(text, text, uuid, text) to service_role;
