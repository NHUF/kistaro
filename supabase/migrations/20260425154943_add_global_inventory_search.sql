create or replace function public.search_inventory(search_term text)
returns table (
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  meta text,
  href text
)
language sql
as $$
  with query as (
    select '%' || trim(coalesce(search_term, '')) || '%' as term
  ),
  location_tag_summary as (
    select
      lt.location_id,
      string_agg(t.name, ', ' order by t.name) as tag_names
    from public.location_tags lt
    join public.tags t on t.id = lt.tag_id
    group by lt.location_id
  ),
  item_tag_summary as (
    select
      it.item_id,
      string_agg(t.name, ', ' order by t.name) as tag_names
    from public.item_tags it
    join public.tags t on t.id = it.tag_id
    group by it.item_id
  ),
  location_results as (
    select
      'location'::text as result_type,
      l.id as result_id,
      l.name as title,
      coalesce(parent.name, 'Root') as subtitle,
      trim(
        both ' |' from concat_ws(
          ' | ',
          case l.type
            when 'undefined' then 'Undefiniert'
            when 'site' then 'Standort (Geografisch)'
            when 'room' then 'Zimmer'
            when 'cabinet' then 'Kasten'
            when 'box' then 'Kiste'
            when 'carton' then 'Karton'
            when 'drawer' then 'Lade'
            else null
          end,
          nullif(l.description, ''),
          nullif(lts.tag_names, '')
        )
      ) as meta,
      '/locations/' || l.id::text as href
    from public.locations l
    left join public.locations parent on parent.id = l.parent_id
    left join location_tag_summary lts on lts.location_id = l.id
    cross join query q
    where trim(coalesce(search_term, '')) <> ''
      and (
        l.name ilike q.term
        or coalesce(l.description, '') ilike q.term
        or coalesce(l.type, '') ilike q.term
        or coalesce(parent.name, '') ilike q.term
        or exists (
          select 1
          from public.location_tags lt
          join public.tags t on t.id = lt.tag_id
          where lt.location_id = l.id
            and t.name ilike q.term
        )
      )
  ),
  item_results as (
    select
      'item'::text as result_type,
      i.id as result_id,
      i.name as title,
      coalesce(l.name, 'Keine Location') as subtitle,
      trim(
        both ' |' from concat_ws(
          ' | ',
          case i.status
            when 'in_use' then 'In Verwendung'
            when 'stored' then 'Eingelagert'
            when 'lost' then 'Verloren'
            when 'loaned' then 'Verborgt'
            else null
          end,
          nullif(i.description, ''),
          nullif(its.tag_names, '')
        )
      ) as meta,
      '/items/' || i.id::text as href
    from public.items i
    left join public.locations l on l.id = i.location_id
    left join item_tag_summary its on its.item_id = i.id
    cross join query q
    where trim(coalesce(search_term, '')) <> ''
      and (
        i.name ilike q.term
        or coalesce(i.description, '') ilike q.term
        or coalesce(i.status, '') ilike q.term
        or coalesce(l.name, '') ilike q.term
        or exists (
          select 1
          from public.item_tags it
          join public.tags t on t.id = it.tag_id
          where it.item_id = i.id
            and t.name ilike q.term
        )
      )
  )
  select *
  from (
    select * from location_results
    union all
    select * from item_results
  ) combined_results
  order by result_type, title;
$$;

grant all on function public.search_inventory(text) to anon;
grant all on function public.search_inventory(text) to authenticated;
grant all on function public.search_inventory(text) to service_role;
