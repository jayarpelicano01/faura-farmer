-- Apply only after the flat-categories preflight has been reviewed and approved.
-- The migration itself is transactional when applied by Prisma on PostgreSQL.

DO $$
DECLARE
  cycle_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'parent_id'
  ) THEN
    EXECUTE $cycle$
      WITH RECURSIVE category_walk AS (
        SELECT
          category."id" AS origin_id,
          category."parent_id" AS next_parent_id,
          ARRAY[category."id"] AS path,
          false AS has_cycle
        FROM "categories" AS category
        WHERE category."parent_id" IS NOT NULL

        UNION ALL

        SELECT
          walk.origin_id,
          parent."parent_id",
          walk.path || parent."id",
          parent."id" = ANY(walk.path)
        FROM category_walk AS walk
        JOIN "categories" AS parent ON parent."id" = walk.next_parent_id
        WHERE NOT walk.has_cycle
      )
      SELECT COUNT(*) FROM category_walk WHERE has_cycle
    $cycle$ INTO cycle_count;

    IF cycle_count > 0 THEN
      RAISE EXCEPTION 'Cannot flatten categories while parent cycles exist; run flat-categories-preflight.sql and correct the reported rows';
    END IF;

    EXECUTE $inheritance$
      WITH RECURSIVE inheritance AS (
        SELECT
          child."id" AS category_id,
          parent."id" AS ancestor_id,
          parent."parent_id" AS next_parent_id,
          parent."bucket" AS bucket,
          1 AS depth
        FROM "categories" AS child
        JOIN "categories" AS parent ON parent."id" = child."parent_id"
        WHERE child."bucket" IS NULL

        UNION ALL

        SELECT
          inheritance.category_id,
          parent."id",
          parent."parent_id",
          parent."bucket",
          inheritance.depth + 1
        FROM inheritance
        JOIN "categories" AS parent ON parent."id" = inheritance.next_parent_id
        WHERE inheritance.bucket IS NULL
      ), nearest_inherited_bucket AS (
        SELECT DISTINCT ON (category_id)
          category_id,
          bucket
        FROM inheritance
        WHERE bucket IS NOT NULL
        ORDER BY category_id, depth
      )
      UPDATE "categories" AS category
      SET "bucket" = inherited.bucket
      FROM nearest_inherited_bucket AS inherited
      WHERE category."id" = inherited.category_id
        AND category."bucket" IS NULL
    $inheritance$;

    EXECUTE 'UPDATE "categories" SET "parent_id" = NULL WHERE "parent_id" IS NOT NULL';
  END IF;
END;
$$;

UPDATE "mobile_sync_changes"
SET "data" = jsonb_set(COALESCE("data", '{}'::jsonb), '{parentId}', 'null'::jsonb, true)
WHERE "entity" = 'category'
  AND "operation" = 'upsert';

DROP TRIGGER IF EXISTS "categories_parent_owner_trigger" ON "categories";
DROP FUNCTION IF EXISTS "assert_category_parent_owner"();
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_parent_id_fkey";
DROP INDEX IF EXISTS "categories_parent_id_idx";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "parent_id";

INSERT INTO "mobile_sync_changes" ("user_id", "entity", "record_id", "operation", "data")
SELECT
  category."user_id",
  'category',
  category."id",
  'upsert',
  jsonb_build_object(
    'id', category."id"::text,
    'name', category."name",
    'type', category."type"::text,
    'parentId', NULL,
    'icon', category."icon",
    'color', category."color",
    'bucket', category."bucket"::text,
    'updatedAt', to_char(category."updated_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
FROM "categories" AS category;
