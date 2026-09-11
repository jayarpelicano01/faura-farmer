-- Run this read-only query before applying the flat-categories migration.
-- Save its output in an immutable approval report under .agents/reports/.

BEGIN TRANSACTION READ ONLY;

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
SELECT
  budget."user_id" AS user_id,
  budget."id" AS budget_id,
  budget."monthly_limit" AS monthly_limit,
  budget_category."id" AS category_id,
  budget_category."name" AS category_name,
  ARRAY_AGG(DISTINCT descendant."id" ORDER BY descendant."id") AS descendant_ids,
  ARRAY_AGG(DISTINCT descendant."name" ORDER BY descendant."name") AS descendant_names
FROM "budgets" AS budget
JOIN "categories" AS budget_category ON budget_category."id" = budget."category_id"
JOIN category_walk AS walk ON walk.next_parent_id = budget."category_id" AND NOT walk.has_cycle
JOIN "categories" AS descendant ON descendant."id" = walk.origin_id
WHERE descendant."user_id" = budget."user_id"
GROUP BY budget."user_id", budget."id", budget."monthly_limit", budget_category."id", budget_category."name"
ORDER BY budget."user_id", budget_category."name", budget."id";

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
SELECT DISTINCT origin_id AS category_id, path AS cycle_path
FROM category_walk
WHERE has_cycle
ORDER BY category_id;

COMMIT;
