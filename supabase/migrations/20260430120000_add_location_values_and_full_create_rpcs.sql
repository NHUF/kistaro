alter table public.locations
add column if not exists value numeric;

alter table public.inventory_templates
add column if not exists location_value numeric;

drop function if exists public.create_location(text, text, uuid, text, text, text);
drop function if exists public.create_location(text, text, uuid, text, text, text, numeric);
create function public.create_location(
  loc_name text,
  loc_type text default null,
  parent_location uuid default null,
  loc_description text default null,
  loc_icon_name text default null,
  loc_image_path text default null,
  loc_value numeric default null
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

  insert into public.locations (
    name,
    parent_id,
    type,
    description,
    icon_name,
    image_path,
    value
  )
  values (
    trim(loc_name),
    parent_location,
    nullif(trim(coalesce(loc_type, '')), ''),
    nullif(trim(coalesce(loc_description, '')), ''),
    nullif(trim(coalesce(loc_icon_name, '')), ''),
    nullif(trim(coalesce(loc_image_path, '')), ''),
    loc_value
  )
  returning id into created_location_id;

  return created_location_id;
end;
$$;

drop function if exists public.update_location(uuid, text, text, uuid, text, text, text);
drop function if exists public.update_location(uuid, text, text, uuid, text, text, text, numeric);
create function public.update_location(
  loc_id uuid,
  loc_name text,
  loc_type text default null,
  parent_location uuid default null,
  loc_description text default null,
  loc_icon_name text default null,
  loc_image_path text default null,
  loc_value numeric default null
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

  if parent_location = loc_id then
    raise exception 'Location cannot be its own parent';
  end if;

  if parent_location is not null and not exists (
    select 1
    from public.locations
    where id = parent_location
  ) then
    raise exception 'Parent location does not exist';
  end if;

  if parent_location is not null and exists (
    with recursive descendants as (
      select id
      from public.locations
      where parent_id = loc_id
      union all
      select child.id
      from public.locations child
      join descendants current_descendant on child.parent_id = current_descendant.id
    )
    select 1
    from descendants
    where id = parent_location
  ) then
    raise exception 'Location cannot be moved into one of its children';
  end if;

  update public.locations
  set
    name = trim(loc_name),
    type = nullif(trim(coalesce(loc_type, '')), ''),
    parent_id = parent_location,
    description = nullif(trim(coalesce(loc_description, '')), ''),
    icon_name = nullif(trim(coalesce(loc_icon_name, '')), ''),
    image_path = nullif(trim(coalesce(loc_image_path, '')), ''),
    value = loc_value
  where id = loc_id;

  if not found then
    raise exception 'Location does not exist';
  end if;
end;
$$;

drop function if exists public.create_item(text, uuid, text, text);
drop function if exists public.create_item(text, uuid, text, text, text, numeric, date, text);
create function public.create_item(
  item_name text,
  target_location uuid,
  item_icon_name text default null,
  item_image_path text default null,
  item_description text default null,
  item_value numeric default null,
  item_purchase_date date default null,
  item_status text default null
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

  insert into public.items (
    name,
    location_id,
    icon_name,
    image_path,
    description,
    value,
    purchase_date,
    status
  )
  values (
    trim(item_name),
    target_location,
    nullif(trim(coalesce(item_icon_name, '')), ''),
    nullif(trim(coalesce(item_image_path, '')), ''),
    nullif(trim(coalesce(item_description, '')), ''),
    item_value,
    item_purchase_date,
    nullif(trim(coalesce(item_status, '')), '')
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

drop function if exists public.create_inventory_template(text, text, text, text, text, text, text, numeric, date);
drop function if exists public.create_inventory_template(text, text, text, text, text, text, text, numeric, date, numeric);
create function public.create_inventory_template(
  template_entity_type text,
  base_name text,
  template_description text default null,
  template_location_type text default null,
  template_item_status text default null,
  template_icon_name text default null,
  template_image_path text default null,
  template_item_value numeric default null,
  template_item_purchase_date date default null,
  template_location_value numeric default null
)
returns uuid
language plpgsql
as $$
declare
  normalized_name text;
  created_template_id uuid;
begin
  if template_entity_type not in ('item', 'location') then
    raise exception 'Template entity type must be item or location';
  end if;

  if trim(coalesce(base_name, '')) = '' then
    raise exception 'Template name is required';
  end if;

  normalized_name := regexp_replace(trim(base_name), '-0000$', '') || '-0000';

  insert into public.inventory_templates (
    entity_type,
    name,
    description,
    location_type,
    item_status,
    icon_name,
    image_path,
    item_value,
    item_purchase_date,
    location_value
  )
  values (
    template_entity_type,
    normalized_name,
    nullif(trim(coalesce(template_description, '')), ''),
    case when template_entity_type = 'location' then nullif(trim(coalesce(template_location_type, '')), '') else null end,
    case when template_entity_type = 'item' then nullif(trim(coalesce(template_item_status, '')), '') else null end,
    nullif(trim(coalesce(template_icon_name, '')), ''),
    nullif(trim(coalesce(template_image_path, '')), ''),
    case when template_entity_type = 'item' then template_item_value else null end,
    case when template_entity_type = 'item' then template_item_purchase_date else null end,
    case when template_entity_type = 'location' then template_location_value else null end
  )
  returning id into created_template_id;

  return created_template_id;
end;
$$;

drop function if exists public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date);
drop function if exists public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date, numeric);
create function public.update_inventory_template(
  target_template_id uuid,
  base_name text,
  template_description text default null,
  template_location_type text default null,
  template_item_status text default null,
  template_icon_name text default null,
  template_image_path text default null,
  template_item_value numeric default null,
  template_item_purchase_date date default null,
  template_location_value numeric default null
)
returns uuid
language plpgsql
as $$
declare
  template_record public.inventory_templates%rowtype;
  normalized_name text;
begin
  if target_template_id is null then
    raise exception 'Template id is required';
  end if;

  select *
  into template_record
  from public.inventory_templates
  where id = target_template_id;

  if not found then
    raise exception 'Template does not exist';
  end if;

  if trim(coalesce(base_name, '')) = '' then
    raise exception 'Template name is required';
  end if;

  normalized_name := regexp_replace(trim(base_name), '-0000$', '') || '-0000';

  update public.inventory_templates
  set
    name = normalized_name,
    description = nullif(trim(coalesce(template_description, '')), ''),
    location_type = case
      when template_record.entity_type = 'location' then nullif(trim(coalesce(template_location_type, '')), '')
      else null
    end,
    item_status = case
      when template_record.entity_type = 'item' then nullif(trim(coalesce(template_item_status, '')), '')
      else null
    end,
    icon_name = nullif(trim(coalesce(template_icon_name, '')), ''),
    image_path = nullif(trim(coalesce(template_image_path, '')), ''),
    item_value = case
      when template_record.entity_type = 'item' then template_item_value
      else null
    end,
    item_purchase_date = case
      when template_record.entity_type = 'item' then template_item_purchase_date
      else null
    end,
    location_value = case
      when template_record.entity_type = 'location' then template_location_value
      else null
    end
  where id = target_template_id;

  return target_template_id;
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
    image_path,
    value
  )
  values (
    public.next_inventory_template_name(template_record.name, 'location'),
    parent_location,
    template_record.location_type,
    template_record.description,
    template_record.icon_name,
    template_record.image_path,
    template_record.location_value
  )
  returning id into created_location_id;

  return created_location_id;
end;
$$;
