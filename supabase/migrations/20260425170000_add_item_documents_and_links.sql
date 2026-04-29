create table if not exists public.item_documents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  title text not null,
  document_type text,
  file_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.item_links (
  item_id uuid not null references public.items(id) on delete cascade,
  linked_item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint item_links_pkey primary key (item_id, linked_item_id),
  constraint item_links_not_same check (item_id <> linked_item_id)
);

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'inventory-documents',
  'inventory-documents',
  true,
  10485760
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read inventory documents'
  ) then
    create policy "Public read inventory documents"
    on storage.objects
    for select
    to public
    using (bucket_id = 'inventory-documents');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public upload inventory documents'
  ) then
    create policy "Public upload inventory documents"
    on storage.objects
    for insert
    to public
    with check (bucket_id = 'inventory-documents');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public update inventory documents'
  ) then
    create policy "Public update inventory documents"
    on storage.objects
    for update
    to public
    using (bucket_id = 'inventory-documents')
    with check (bucket_id = 'inventory-documents');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public delete inventory documents'
  ) then
    create policy "Public delete inventory documents"
    on storage.objects
    for delete
    to public
    using (bucket_id = 'inventory-documents');
  end if;
end
$$;

create or replace function public.create_item_document(
  target_item_id uuid,
  document_title text,
  document_type text default null,
  document_file_path text default null
)
returns uuid
language plpgsql
as $$
declare
  created_document_id uuid;
begin
  if target_item_id is null then
    raise exception 'Item id is required';
  end if;

  if trim(coalesce(document_title, '')) = '' then
    raise exception 'Document title is required';
  end if;

  if trim(coalesce(document_file_path, '')) = '' then
    raise exception 'Document file path is required';
  end if;

  if not exists (
    select 1
    from public.items
    where id = target_item_id
  ) then
    raise exception 'Item does not exist';
  end if;

  insert into public.item_documents (item_id, title, document_type, file_path)
  values (
    target_item_id,
    trim(document_title),
    nullif(trim(coalesce(document_type, '')), ''),
    trim(document_file_path)
  )
  returning id into created_document_id;

  return created_document_id;
end;
$$;

create or replace function public.delete_item_document(
  target_document_id uuid
)
returns void
language plpgsql
as $$
begin
  if target_document_id is null then
    raise exception 'Document id is required';
  end if;

  if not exists (
    select 1
    from public.item_documents
    where id = target_document_id
  ) then
    raise exception 'Document does not exist';
  end if;

  delete from public.item_documents
  where id = target_document_id;
end;
$$;

create or replace function public.attach_item_link(
  source_item_id uuid,
  target_item_id uuid
)
returns void
language plpgsql
as $$
begin
  if source_item_id is null or target_item_id is null then
    raise exception 'Both item ids are required';
  end if;

  if source_item_id = target_item_id then
    raise exception 'Item cannot be linked to itself';
  end if;

  if not exists (select 1 from public.items where id = source_item_id) then
    raise exception 'Source item does not exist';
  end if;

  if not exists (select 1 from public.items where id = target_item_id) then
    raise exception 'Target item does not exist';
  end if;

  insert into public.item_links (item_id, linked_item_id)
  values (source_item_id, target_item_id)
  on conflict (item_id, linked_item_id) do nothing;

  insert into public.item_links (item_id, linked_item_id)
  values (target_item_id, source_item_id)
  on conflict (item_id, linked_item_id) do nothing;
end;
$$;

create or replace function public.detach_item_link(
  source_item_id uuid,
  target_item_id uuid
)
returns void
language plpgsql
as $$
begin
  if source_item_id is null or target_item_id is null then
    raise exception 'Both item ids are required';
  end if;

  delete from public.item_links
  where (item_id = source_item_id and linked_item_id = target_item_id)
     or (item_id = target_item_id and linked_item_id = source_item_id);
end;
$$;

grant all on table public.item_documents to anon;
grant all on table public.item_documents to authenticated;
grant all on table public.item_documents to service_role;

grant all on table public.item_links to anon;
grant all on table public.item_links to authenticated;
grant all on table public.item_links to service_role;

grant all on function public.create_item_document(uuid, text, text, text) to anon;
grant all on function public.create_item_document(uuid, text, text, text) to authenticated;
grant all on function public.create_item_document(uuid, text, text, text) to service_role;

grant all on function public.delete_item_document(uuid) to anon;
grant all on function public.delete_item_document(uuid) to authenticated;
grant all on function public.delete_item_document(uuid) to service_role;

grant all on function public.attach_item_link(uuid, uuid) to anon;
grant all on function public.attach_item_link(uuid, uuid) to authenticated;
grant all on function public.attach_item_link(uuid, uuid) to service_role;

grant all on function public.detach_item_link(uuid, uuid) to anon;
grant all on function public.detach_item_link(uuid, uuid) to authenticated;
grant all on function public.detach_item_link(uuid, uuid) to service_role;
