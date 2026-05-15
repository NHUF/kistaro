alter table public.items
  add column if not exists quantity integer;

update public.items
set quantity = 1
where quantity is null
  or quantity < 1;

alter table public.items
  alter column quantity set default 1;

alter table public.items
  alter column quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_quantity_check'
  ) then
    alter table public.items
      add constraint items_quantity_check check (quantity >= 1);
  end if;
end
$$;

alter table public.inventory_templates
  add column if not exists item_quantity integer;

update public.inventory_templates
set item_quantity = 1
where entity_type = 'item'
  and (item_quantity is null or item_quantity < 1);

update public.inventory_templates
set item_quantity = null
where entity_type = 'location';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_templates_item_quantity_check'
  ) then
    alter table public.inventory_templates
      add constraint inventory_templates_item_quantity_check check (
        item_quantity is null or item_quantity >= 1
      );
  end if;
end
$$;

drop function if exists public.create_item(text, uuid, text, text, text, numeric, date, text);
drop function if exists public.create_item(text, uuid, text, text, text, numeric, date, text, integer);
create function public.create_item(
  item_name text,
  target_location uuid,
  item_icon_name text default null,
  item_image_path text default null,
  item_description text default null,
  item_value numeric default null,
  item_purchase_date date default null,
  item_status text default null,
  item_quantity integer default 1
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

  if item_quantity is null or item_quantity < 1 then
    raise exception 'Item quantity must be at least 1';
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
    status,
    quantity
  )
  values (
    trim(item_name),
    target_location,
    nullif(trim(coalesce(item_icon_name, '')), ''),
    nullif(trim(coalesce(item_image_path, '')), ''),
    nullif(trim(coalesce(item_description, '')), ''),
    item_value,
    item_purchase_date,
    nullif(trim(coalesce(item_status, '')), ''),
    item_quantity
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

drop function if exists public.update_item_details(uuid, text, text, numeric, date, text, text, text);
drop function if exists public.update_item_details(uuid, text, text, numeric, date, text, text, text, integer);
create function public.update_item_details(
  item_id uuid,
  item_name text,
  item_description text default null,
  item_value numeric default null,
  item_purchase_date date default null,
  item_status text default null,
  item_icon_name text default null,
  item_image_path text default null,
  item_quantity integer default 1
)
returns uuid
language plpgsql
as $$
begin
  if item_id is null then
    raise exception 'Item id is required';
  end if;

  if trim(coalesce(item_name, '')) = '' then
    raise exception 'Item name is required';
  end if;

  if item_quantity is null or item_quantity < 1 then
    raise exception 'Item quantity must be at least 1';
  end if;

  update public.items
  set
    name = trim(item_name),
    description = nullif(trim(coalesce(item_description, '')), ''),
    value = item_value,
    purchase_date = item_purchase_date,
    status = nullif(trim(coalesce(item_status, '')), ''),
    icon_name = nullif(trim(coalesce(item_icon_name, '')), ''),
    image_path = nullif(trim(coalesce(item_image_path, '')), ''),
    quantity = item_quantity
  where id = item_id;

  if not found then
    raise exception 'Item does not exist';
  end if;

  return item_id;
end;
$$;

drop function if exists public.create_inventory_template(text, text, text, text, text, text, text, numeric, date, numeric);
drop function if exists public.create_inventory_template(text, text, text, text, text, text, text, numeric, date, integer, numeric);
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
  template_item_quantity integer default 1,
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

  if template_entity_type = 'item' and (template_item_quantity is null or template_item_quantity < 1) then
    raise exception 'Template item quantity must be at least 1';
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
    item_quantity,
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
    case when template_entity_type = 'item' then template_item_quantity else null end,
    case when template_entity_type = 'location' then template_location_value else null end
  )
  returning id into created_template_id;

  return created_template_id;
end;
$$;

drop function if exists public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date, numeric);
drop function if exists public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date, integer, numeric);
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
  template_item_quantity integer default 1,
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

  if template_record.entity_type = 'item' and (template_item_quantity is null or template_item_quantity < 1) then
    raise exception 'Template item quantity must be at least 1';
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
    item_quantity = case
      when template_record.entity_type = 'item' then template_item_quantity
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
    image_path,
    quantity
  )
  values (
    public.next_inventory_template_name(template_record.name, 'item'),
    target_location,
    template_record.description,
    template_record.item_value,
    template_record.item_purchase_date,
    template_record.item_status,
    template_record.icon_name,
    template_record.image_path,
    coalesce(template_record.item_quantity, 1)
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;
