update public.locations
set type = lower(trim(type));

update public.locations
set type = 'generic'
where type is null or trim(type) = '';

alter table public.locations
  alter column type set default 'generic';

alter table public.locations
  drop constraint if exists locations_type_check;

alter table public.locations
  add constraint locations_type_check
  check (type in ('generic', 'place', 'room', 'storage', 'container', 'shelf'));

update public.items
set status = lower(trim(status));

update public.items
set status = 'active'
where status is null or trim(status) = '';

alter table public.items
  alter column status set default 'active';

alter table public.items
  drop constraint if exists items_status_check;

alter table public.items
  add constraint items_status_check
  check (status in ('active', 'stored', 'missing', 'archived'));

update public.tags
set name = trim(name)
where name is not null;

alter table public.tags
  drop constraint if exists tags_name_key;

create unique index if not exists tags_name_unique_idx
  on public.tags (lower(name));

create table if not exists public.location_tags (
  location_id uuid not null,
  tag_id uuid not null,
  created_at timestamp without time zone not null default now(),
  constraint location_tags_pkey primary key (location_id, tag_id),
  constraint location_tags_location_id_fkey
    foreign key (location_id) references public.locations(id) on delete cascade,
  constraint location_tags_tag_id_fkey
    foreign key (tag_id) references public.tags(id) on delete cascade
);

grant all on table public.location_tags to anon;
grant all on table public.location_tags to authenticated;
grant all on table public.location_tags to service_role;

create or replace function public.find_or_create_tag(
  tag_name text
)
returns uuid
language plpgsql
as $$
declare
  normalized_name text;
  existing_tag_id uuid;
begin
  normalized_name := trim(coalesce(tag_name, ''));

  if normalized_name = '' then
    raise exception 'Tag name is required';
  end if;

  select id
  into existing_tag_id
  from public.tags
  where lower(name) = lower(normalized_name)
  limit 1;

  if existing_tag_id is not null then
    return existing_tag_id;
  end if;

  insert into public.tags (name)
  values (normalized_name)
  returning id into existing_tag_id;

  return existing_tag_id;
end;
$$;

create or replace function public.attach_item_tag(
  item_id uuid,
  tag_name text
)
returns uuid
language plpgsql
as $$
declare
  resolved_tag_id uuid;
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

  resolved_tag_id := public.find_or_create_tag(tag_name);

  insert into public.item_tags (item_id, tag_id)
  values (item_id, resolved_tag_id)
  on conflict (item_id, tag_id) do nothing;

  return resolved_tag_id;
end;
$$;

create or replace function public.detach_item_tag(
  item_id uuid,
  tag_id uuid
)
returns void
language plpgsql
as $$
begin
  if item_id is null or tag_id is null then
    raise exception 'Item id and tag id are required';
  end if;

  delete from public.item_tags
  where item_tags.item_id = detach_item_tag.item_id
    and item_tags.tag_id = detach_item_tag.tag_id;
end;
$$;

create or replace function public.attach_location_tag(
  loc_id uuid,
  tag_name text
)
returns uuid
language plpgsql
as $$
declare
  resolved_tag_id uuid;
begin
  if loc_id is null then
    raise exception 'Location id is required';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = loc_id
  ) then
    raise exception 'Location does not exist';
  end if;

  resolved_tag_id := public.find_or_create_tag(tag_name);

  insert into public.location_tags (location_id, tag_id)
  values (loc_id, resolved_tag_id)
  on conflict (location_id, tag_id) do nothing;

  return resolved_tag_id;
end;
$$;

create or replace function public.detach_location_tag(
  loc_id uuid,
  tag_id uuid
)
returns void
language plpgsql
as $$
begin
  if loc_id is null or tag_id is null then
    raise exception 'Location id and tag id are required';
  end if;

  delete from public.location_tags
  where location_tags.location_id = detach_location_tag.loc_id
    and location_tags.tag_id = detach_location_tag.tag_id;
end;
$$;

grant all on function public.find_or_create_tag(text) to anon;
grant all on function public.find_or_create_tag(text) to authenticated;
grant all on function public.find_or_create_tag(text) to service_role;

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
