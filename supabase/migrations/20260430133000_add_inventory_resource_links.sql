create table if not exists public.inventory_resource_links (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('item', 'location', 'template')),
  entity_id uuid not null,
  label text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_resource_links_entity_idx
  on public.inventory_resource_links (entity_type, entity_id);

alter table public.inventory_templates
add column if not exists links jsonb not null default '[]'::jsonb;

create or replace function public.create_resource_link(
  target_entity_type text,
  target_entity_id uuid,
  link_label text,
  link_url text
)
returns uuid
language plpgsql
as $$
declare
  created_link_id uuid;
begin
  if target_entity_type not in ('item', 'location', 'template') then
    raise exception 'Unsupported link entity type';
  end if;

  if target_entity_id is null then
    raise exception 'Target entity id is required';
  end if;

  if trim(coalesce(link_label, '')) = '' then
    raise exception 'Link label is required';
  end if;

  if trim(coalesce(link_url, '')) = '' then
    raise exception 'Link URL is required';
  end if;

  insert into public.inventory_resource_links (entity_type, entity_id, label, url)
  values (
    target_entity_type,
    target_entity_id,
    trim(link_label),
    trim(link_url)
  )
  returning id into created_link_id;

  return created_link_id;
end;
$$;

create or replace function public.delete_resource_link(
  target_link_id uuid
)
returns void
language plpgsql
as $$
begin
  if target_link_id is null then
    raise exception 'Link id is required';
  end if;

  delete from public.inventory_resource_links
  where id = target_link_id;
end;
$$;
