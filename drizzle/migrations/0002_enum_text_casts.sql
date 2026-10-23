-- The RDS Data API sends every string parameter as `text`. Postgres has no assignment cast from
-- text to an enum, so INSERT/UPDATE of an enum column from the Data API fails without these.
-- Production already had them for the first four enums (created by hand); this records them in
-- the repo and adds media_source. Comparisons still need an explicit cast (see db/enum.ts).
DO $$
DECLARE
  enum_name text;
BEGIN
  FOREACH enum_name IN ARRAY ARRAY['access', 'item_kind', 'media_kind', 'pricing', 'media_source'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_cast c
      JOIN pg_type s ON s.oid = c.castsource
      JOIN pg_type t ON t.oid = c.casttarget
      WHERE s.typname = 'text' AND t.typname = enum_name
    ) THEN
      EXECUTE format('CREATE CAST (text AS %I) WITH INOUT AS IMPLICIT', enum_name);
    END IF;
  END LOOP;
END $$;
