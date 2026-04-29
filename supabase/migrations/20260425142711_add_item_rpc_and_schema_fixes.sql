alter table public.items
  alter column location_id drop default;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'purchasee_date'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'purchase_date'
  ) then
    alter table public.items rename column purchasee_date to purchase_date;
  end if;
end
$$;

alter table public.item_tags
  alter column item_id drop default,
  alter column tag_id drop default;

alter table public.item_tags
  drop constraint if exists item_tags_pkey;

alter table public.item_tags
  add constraint item_tags_pkey primary key (item_id, tag_id);

alter table public.item_tags
  drop constraint if exists item_tags_item_id_fkey,
  drop constraint if exists item_tags_tag_id_fkey;

alter table public.item_tags
  add constraint item_tags_item_id_fkey
    foreign key (item_id) references public.items(id) on delete cascade,
  add constraint item_tags_tag_id_fkey
    foreign key (tag_id) references public.tags(id) on delete cascade;

create or replace function public.create_item(
  item_name text,
  target_location uuid
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

  insert into public.items (name, location_id)
  values (trim(item_name), target_location)
  returning id into created_item_id;

  return created_item_id;
end;
$$;

create or replace function public.update_item(
  item_id uuid,
  item_name text
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
  set name = trim(item_name)
  where id = item_id;
end;
$$;

create or replace function public.move_item(
  item_id uuid,
  target_location uuid
)
returns void
language plpgsql
as $$
begin
  if item_id is null then
    raise exception 'Item id is required';
  end if;

  if target_location is null then
    raise exception 'Items must belong to a location';
  end if;

  if not exists (
    select 1
    from public.items
    where id = item_id
  ) then
    raise exception 'Item does not exist';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = target_location
  ) then
    raise exception 'Target location does not exist';
  end if;

  update public.items
  set location_id = target_location
  where id = item_id;
end;
$$;

create or replace function public.delete_item(
  item_id uuid
)
returns void
language plpgsql
as $$
begin
  if item_id is null then
    raise exception 'Item id is required';
  end if;

  if not exists (
    select 1
    from public.items
    where id = item_id
  ) then
    raise exception 'Item does not exist';
  end if;

  delete from public.items
  where id = item_id;
end;
$$;

grant all on function public.create_item(text, uuid) to anon;
grant all on function public.create_item(text, uuid) to authenticated;
grant all on function public.create_item(text, uuid) to service_role;

grant all on function public.update_item(uuid, text) to anon;
grant all on function public.update_item(uuid, text) to authenticated;
grant all on function public.update_item(uuid, text) to service_role;

grant all on function public.move_item(uuid, uuid) to anon;
grant all on function public.move_item(uuid, uuid) to authenticated;
grant all on function public.move_item(uuid, uuid) to service_role;

grant all on function public.delete_item(uuid) to anon;
grant all on function public.delete_item(uuid) to authenticated;
grant all on function public.delete_item(uuid) to service_role;
