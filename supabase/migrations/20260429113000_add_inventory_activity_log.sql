create table if not exists public.inventory_activity_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text,
  action text not null check (action in ('create', 'update', 'delete', 'move', 'attach', 'detach')),
  title text not null,
  description text,
  actor_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_activity_log_created_at_idx
  on public.inventory_activity_log (created_at desc);

create or replace function public.log_inventory_activity(
  event_entity_type text,
  event_entity_id text default null,
  event_action text default 'update',
  event_title text default '',
  event_description text default null,
  event_actor_label text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  created_log_id bigint;
begin
  if trim(coalesce(event_entity_type, '')) = '' then
    raise exception 'Entity type is required';
  end if;

  if trim(coalesce(event_action, '')) = '' then
    raise exception 'Action is required';
  end if;

  if trim(coalesce(event_title, '')) = '' then
    raise exception 'Title is required';
  end if;

  insert into public.inventory_activity_log (
    entity_type,
    entity_id,
    action,
    title,
    description,
    actor_label,
    metadata
  )
  values (
    trim(event_entity_type),
    nullif(trim(coalesce(event_entity_id, '')), ''),
    trim(event_action),
    trim(event_title),
    nullif(trim(coalesce(event_description, '')), ''),
    nullif(trim(coalesce(event_actor_label, '')), ''),
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into created_log_id;

  return created_log_id;
end;
$$;

grant select on public.inventory_activity_log to anon, authenticated, service_role;
grant execute on function public.log_inventory_activity(text, text, text, text, text, text, jsonb)
  to anon, authenticated, service_role;
