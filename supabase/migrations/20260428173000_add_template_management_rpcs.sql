create or replace function public.update_inventory_template(
  target_template_id uuid,
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
      when template_record.entity_type = 'location' then template_location_type
      else null
    end,
    item_status = case
      when template_record.entity_type = 'item' then template_item_status
      else null
    end,
    icon_name = nullif(trim(coalesce(template_icon_name, '')), ''),
    image_path = template_image_path,
    item_value = case
      when template_record.entity_type = 'item' then template_item_value
      else null
    end,
    item_purchase_date = case
      when template_record.entity_type = 'item' then template_item_purchase_date
      else null
    end
  where id = target_template_id;

  return target_template_id;
end;
$$;

create or replace function public.delete_inventory_template(
  target_template_id uuid
)
returns void
language plpgsql
as $$
begin
  if target_template_id is null then
    raise exception 'Template id is required';
  end if;

  delete from public.inventory_templates
  where id = target_template_id;

  if not found then
    raise exception 'Template does not exist';
  end if;
end;
$$;

grant all on function public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date) to anon;
grant all on function public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date) to authenticated;
grant all on function public.update_inventory_template(uuid, text, text, text, text, text, text, numeric, date) to service_role;

grant all on function public.delete_inventory_template(uuid) to anon;
grant all on function public.delete_inventory_template(uuid) to authenticated;
grant all on function public.delete_inventory_template(uuid) to service_role;
