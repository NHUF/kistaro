


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."delete_location"("loc_id" "uuid", "strategy" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  parent uuid;
  box_id uuid;
begin

  -- parent holen
  select parent_id into parent from locations where id = loc_id;

if strategy = 'unpack' then

  -- Fall 1: Parent existiert
  if parent is not null then

    -- Locations nach oben verschieben
    update locations
    set parent_id = parent
    where parent_id = loc_id;

    -- Items ebenfalls direkt nach oben
    update items
    set location_id = parent
    where location_id = loc_id;

  else
    -- Fall 2: Root → Items brauchen Karton

    insert into locations (name, parent_id, type)
    values (
      'Karton-' || (select name from locations where id = loc_id),
      null,
      'container'
    )
    returning id into box_id;

    -- Locations auf Root
    update locations
    set parent_id = null
    where parent_id = loc_id;

    -- Items in Karton
    update items
    set location_id = box_id
    where location_id = loc_id;

  end if;

end if;

  -- 📦 STRATEGIE: BOX
  if strategy = 'box' then

    insert into locations (name, parent_id, type)
    values ('Karton', parent, 'container')
    returning id into box_id;

    update locations
    set parent_id = box_id
    where parent_id = loc_id;

    update items
    set location_id = box_id
    where location_id = loc_id;

  end if;

  -- 🧨 STRATEGIE: DELETE
  if strategy = 'delete' then

    delete from items
    where location_id in (
      with recursive tree as (
        select id from locations where id = loc_id
        union
        select l.id from locations l
        join tree t on l.parent_id = t.id
      )
      select id from tree
    );

    delete from locations
    where id in (
      with recursive tree as (
        select id from locations where id = loc_id
        union
        select l.id from locations l
        join tree t on l.parent_id = t.id
      )
      select id from tree
    );

    return;

  end if;

  -- zuletzt die location selbst löschen
  delete from locations where id = loc_id;

end;
$$;


ALTER FUNCTION "public"."delete_location"("loc_id" "uuid", "strategy" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_location"("loc_id" "uuid", "new_parent" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin

  -- ❌ sich selbst als parent verbieten
  if loc_id = new_parent then
    raise exception 'Cannot move location into itself';
  end if;

  -- ❌ verhindern, dass man in eigenes child verschiebt
  if exists (
    with recursive tree as (
      select id, parent_id from locations where parent_id = loc_id
      union
      select l.id, l.parent_id
      from locations l
      join tree t on l.parent_id = t.id
    )
    select 1 from tree where id = new_parent
  ) then
    raise exception 'Cannot move into child location';
  end if;

  -- ✅ move
  update locations
  set parent_id = new_parent
  where id = loc_id;

end;
$$;


ALTER FUNCTION "public"."move_location"("loc_id" "uuid", "new_parent" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."item_tags" (
    "item_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."item_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text",
    "value" numeric,
    "purchasee_date" "date",
    "status" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "parent_id" "uuid",
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."locations" IS 'Ort von Items';



CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


ALTER TABLE ONLY "public"."item_tags"
    ADD CONSTRAINT "item_tags_pkey" PRIMARY KEY ("item_id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id");





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."delete_location"("loc_id" "uuid", "strategy" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_location"("loc_id" "uuid", "strategy" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_location"("loc_id" "uuid", "strategy" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."move_location"("loc_id" "uuid", "new_parent" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."move_location"("loc_id" "uuid", "new_parent" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_location"("loc_id" "uuid", "new_parent" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."item_tags" TO "anon";
GRANT ALL ON TABLE "public"."item_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."item_tags" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


