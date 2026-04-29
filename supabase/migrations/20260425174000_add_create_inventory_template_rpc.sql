create or replace function public.create_inventory_template(
  template_entity_type text,
  base_name text,
  template_description text default null,
  template_location_type text default null,
  template_item_status text default null,
  template_icon_name text default null,
  template_image_path text default null,
  template_item_value numeric default null,
  template_item_purchase_date date default null
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
    item_purchase_date
  )
  values (
    template_entity_type,
    normalized_name,
    nullif(trim(coalesce(template_description, '')), ''),
    nullif(trim(coalesce(template_location_type, '')), ''),
    nullif(trim(coalesce(template_item_status, '')), ''),
    nullif(trim(coalesce(template_icon_name, '')), ''),
    nullif(trim(coalesce(template_image_path, '')), ''),
    template_item_value,
    template_item_purchase_date
  )
  returning id into created_template_id;

  return created_template_id;
end;
$$;

grant all on function public.create_inventory_template(text, text, text, text, text, text, text, numeric, date) to anon;
grant all on function public.create_inventory_template(text, text, text, text, text, text, text, numeric, date) to authenticated;
grant all on function public.create_inventory_template(text, text, text, text, text, text, text, numeric, date) to service_role;
