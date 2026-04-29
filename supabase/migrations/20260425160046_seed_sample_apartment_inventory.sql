do $$
declare
  apartment_id uuid;
  living_room_id uuid;
  bedroom_id uuid;
  office_id uuid;
  hallway_drawer_id uuid;
  bedroom_cabinet_id uuid;
  office_box_id uuid;
begin
  select id into apartment_id
  from public.locations
  where name = 'Wohnung Muster'
  limit 1;

  if apartment_id is null then
    insert into public.locations (name, type, description)
    values ('Wohnung Muster', 'site', 'Beispielwohnung fuer die Inventarstruktur')
    returning id into apartment_id;
  end if;

  select id into living_room_id
  from public.locations
  where name = 'Wohnzimmer' and parent_id = apartment_id
  limit 1;

  if living_room_id is null then
    insert into public.locations (name, type, parent_id, description)
    values ('Wohnzimmer', 'room', apartment_id, 'Wohnbereich und Medien')
    returning id into living_room_id;
  end if;

  select id into bedroom_id
  from public.locations
  where name = 'Schlafzimmer' and parent_id = apartment_id
  limit 1;

  if bedroom_id is null then
    insert into public.locations (name, type, parent_id, description)
    values ('Schlafzimmer', 'room', apartment_id, 'Kleidung und Bettwaesche')
    returning id into bedroom_id;
  end if;

  select id into office_id
  from public.locations
  where name = 'Arbeitszimmer' and parent_id = apartment_id
  limit 1;

  if office_id is null then
    insert into public.locations (name, type, parent_id, description)
    values ('Arbeitszimmer', 'room', apartment_id, 'Arbeitsplatz und Technik')
    returning id into office_id;
  end if;

  select id into hallway_drawer_id
  from public.locations
  where name = 'Flurlade' and parent_id = apartment_id
  limit 1;

  if hallway_drawer_id is null then
    insert into public.locations (name, type, parent_id, description)
    values ('Flurlade', 'drawer', apartment_id, 'Kleine Alltagsgegenstaende')
    returning id into hallway_drawer_id;
  end if;

  select id into bedroom_cabinet_id
  from public.locations
  where name = 'Kleiderschrank' and parent_id = bedroom_id
  limit 1;

  if bedroom_cabinet_id is null then
    insert into public.locations (name, type, parent_id, description)
    values ('Kleiderschrank', 'cabinet', bedroom_id, 'Kleidung und Bettzeug')
    returning id into bedroom_cabinet_id;
  end if;

  select id into office_box_id
  from public.locations
  where name = 'Technikkiste' and parent_id = office_id
  limit 1;

  if office_box_id is null then
    insert into public.locations (name, type, parent_id, description)
    values ('Technikkiste', 'box', office_id, 'Kabel und Zubehoer')
    returning id into office_box_id;
  end if;

  insert into public.items (name, location_id, description, status)
  select 'Fernbedienung', living_room_id, 'Liegt beim Fernseher', 'in_use'
  where not exists (
    select 1 from public.items where name = 'Fernbedienung' and location_id = living_room_id
  );

  insert into public.items (name, location_id, description, status)
  select 'Wolldecke', living_room_id, 'Fuer das Sofa', 'stored'
  where not exists (
    select 1 from public.items where name = 'Wolldecke' and location_id = living_room_id
  );

  insert into public.items (name, location_id, description, status)
  select 'Bettwaesche', bedroom_cabinet_id, 'Reserve fuer das Doppelbett', 'stored'
  where not exists (
    select 1 from public.items where name = 'Bettwaesche' and location_id = bedroom_cabinet_id
  );

  insert into public.items (name, location_id, description, status)
  select 'Reisepassmappe', hallway_drawer_id, 'Wichtige Dokumente', 'stored'
  where not exists (
    select 1 from public.items where name = 'Reisepassmappe' and location_id = hallway_drawer_id
  );

  insert into public.items (name, location_id, description, status)
  select 'Laptop', office_id, 'Arbeitsgeraet', 'in_use'
  where not exists (
    select 1 from public.items where name = 'Laptop' and location_id = office_id
  );

  insert into public.items (name, location_id, description, status)
  select 'Ladekabel USB-C', office_box_id, 'Zubehoer fuer Laptop und Tablet', 'stored'
  where not exists (
    select 1 from public.items where name = 'Ladekabel USB-C' and location_id = office_box_id
  );
end
$$;
