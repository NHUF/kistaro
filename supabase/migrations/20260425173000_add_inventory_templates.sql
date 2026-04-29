create table if not exists public.inventory_templates (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('item', 'location')),
  name text not null unique,
  description text,
  location_type text,
  item_status text,
  icon_name text,
  image_path text,
  item_value numeric,
  item_purchase_date date,
  created_at timestamptz not null default now(),
  constraint inventory_templates_name_format check (name ~ '-0000$')
);

create or replace function public.next_inventory_template_name(
  template_name text,
  template_entity_type text
)
returns text
language plpgsql
as $$
declare
  prefix text;
  next_number integer;
begin
  if trim(coalesce(template_name, '')) = '' then
    raise exception 'Template name is required';
  end if;

  if template_name !~ '-0000$' then
    raise exception 'Template name must end with -0000';
  end if;

  prefix := left(template_name, length(template_name) - 4);

  if template_entity_type = 'item' then
    select coalesce(max(right(name, 4)::integer), 0) + 1
    into next_number
    from public.items
    where name like prefix || '%'
      and right(name, 4) ~ '^[0-9]{4}$';
  elsif template_entity_type = 'location' then
    select coalesce(max(right(name, 4)::integer), 0) + 1
    into next_number
    from public.locations
    where name like prefix || '%'
      and right(name, 4) ~ '^[0-9]{4}$';
  else
    raise exception 'Unsupported template entity type';
  end if;

  return prefix || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.create_item_from_template(
  template_id uuid,
  target_location uuid
)
returns uuid
language plpgsql
as $$
declare
  template_record public.inventory_templates%rowtype;
  created_item_id uuid;
begin
  if template_id is null then
    raise exception 'Template id is required';
  end if;

  if target_location is null then
    raise exception 'Items must belong to a location';
  end if;

  select *
  into template_record
  from public.inventory_templates
  where id = template_id
    and entity_type = 'item';

  if not found then
    raise exception 'Item template does not exist';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = target_location
  ) then
    raise exception 'Target location does not exist';
  end if;

  insert into public.items (
    name,
    location_id,
    description,
    value,
    purchase_date,
    status,
    icon_name,
    image_path
  )
  values (
    public.next_inventory_template_name(template_record.name, 'item'),
    target_location,
    template_record.description,
    template_record.item_value,
    template_record.item_purchase_date,
    template_record.item_status,
    template_record.icon_name,
    template_record.image_path
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

create or replace function public.create_location_from_template(
  template_id uuid,
  parent_location uuid default null
)
returns uuid
language plpgsql
as $$
declare
  template_record public.inventory_templates%rowtype;
  created_location_id uuid;
begin
  if template_id is null then
    raise exception 'Template id is required';
  end if;

  select *
  into template_record
  from public.inventory_templates
  where id = template_id
    and entity_type = 'location';

  if not found then
    raise exception 'Location template does not exist';
  end if;

  if parent_location is not null and not exists (
    select 1
    from public.locations
    where id = parent_location
  ) then
    raise exception 'Parent location does not exist';
  end if;

  insert into public.locations (
    name,
    parent_id,
    type,
    description,
    icon_name,
    image_path
  )
  values (
    public.next_inventory_template_name(template_record.name, 'location'),
    parent_location,
    template_record.location_type,
    template_record.description,
    template_record.icon_name,
    template_record.image_path
  )
  returning id into created_location_id;

  return created_location_id;
end;
$$;

insert into public.inventory_templates (
  entity_type,
  name,
  description,
  location_type,
  item_status,
  icon_name
)
values
  ('location', 'KASTEN-0000', 'Vorlage fuer Schraenke und Kaesten', 'cabinet', null, 'MdCheckroom'),
  ('location', 'KISTE-0000', 'Vorlage fuer mobile Kisten', 'box', null, 'MdInventory2'),
  ('location', 'KARTON-0000', 'Vorlage fuer Kartons und Versandboxen', 'carton', null, 'MdArchive'),
  ('item', 'KABEL-0000', 'Vorlage fuer Kabel und Adapter', null, 'stored', 'MdCable'),
  ('item', 'GEWAND-0000', 'Vorlage fuer Kleidung und Textilien', null, 'stored', 'MdCheckroom')
on conflict (name) do nothing;

grant all on table public.inventory_templates to anon;
grant all on table public.inventory_templates to authenticated;
grant all on table public.inventory_templates to service_role;

grant all on function public.next_inventory_template_name(text, text) to anon;
grant all on function public.next_inventory_template_name(text, text) to authenticated;
grant all on function public.next_inventory_template_name(text, text) to service_role;

grant all on function public.create_item_from_template(uuid, uuid) to anon;
grant all on function public.create_item_from_template(uuid, uuid) to authenticated;
grant all on function public.create_item_from_template(uuid, uuid) to service_role;

grant all on function public.create_location_from_template(uuid, uuid) to anon;
grant all on function public.create_location_from_template(uuid, uuid) to authenticated;
grant all on function public.create_location_from_template(uuid, uuid) to service_role;
