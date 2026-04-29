alter table public.locations
  drop constraint if exists locations_type_check;

update public.locations
set type = case lower(trim(type))
  when 'generic' then 'undefined'
  when 'place' then 'site'
  when 'room' then 'room'
  when 'storage' then 'cabinet'
  when 'container' then 'box'
  when 'shelf' then 'drawer'
  else 'undefined'
end;

alter table public.locations
  alter column type set default 'undefined';

alter table public.locations
  add constraint locations_type_check
  check (type in ('undefined', 'site', 'room', 'cabinet', 'box', 'carton', 'drawer'));

alter table public.items
  drop constraint if exists items_status_check;

update public.items
set status = case lower(trim(status))
  when 'active' then 'in_use'
  when 'stored' then 'stored'
  when 'missing' then 'lost'
  when 'archived' then 'stored'
  else 'stored'
end;

alter table public.items
  alter column status set default 'stored';

alter table public.items
  add constraint items_status_check
  check (status in ('in_use', 'stored', 'lost', 'loaned'));
