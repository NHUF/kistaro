alter table public.inventory_templates
add column if not exists tag_names text[] not null default '{}'::text[];

update public.inventory_templates
set tag_names = '{}'::text[]
where tag_names is null;
