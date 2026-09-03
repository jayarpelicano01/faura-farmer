-- Phase 3 mobile support. This migration is intentionally committed only; it
-- must be applied to a dedicated staging database after separate approval.
ALTER TABLE "accounts" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "categories" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "categories" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "mobile_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "session_version" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_sessions_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "mobile_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "mobile_sessions_user_id_device_id_expires_at_idx" ON "mobile_sessions"("user_id", "device_id", "expires_at");

CREATE TABLE "mobile_sync_changes" (
  "cursor" BIGSERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "entity" TEXT NOT NULL,
  "record_id" UUID NOT NULL,
  "operation" TEXT NOT NULL,
  "data" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_sync_changes_pkey" PRIMARY KEY ("cursor"),
  CONSTRAINT "mobile_sync_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "mobile_sync_changes_user_id_cursor_idx" ON "mobile_sync_changes"("user_id", "cursor");
CREATE INDEX "mobile_sync_changes_user_id_entity_record_id_cursor_idx" ON "mobile_sync_changes"("user_id", "entity", "record_id", "cursor");

CREATE TABLE "mobile_mutations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "client_mutation_id" UUID NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_mutations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_mutations_user_id_client_mutation_id_key" UNIQUE ("user_id", "client_mutation_id"),
  CONSTRAINT "mobile_mutations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "mobile_mutations_user_id_created_at_idx" ON "mobile_mutations"("user_id", "created_at");

-- Seed the first mobile pull with the pre-existing staging data. Later writes
-- append their own canonical change in the mutation transaction. Transfer
-- pairs are exposed only through their outgoing (logical) record.
INSERT INTO "mobile_sync_changes" ("user_id", "entity", "record_id", "operation", "data")
SELECT
  a."user_id", 'account', a."id", 'upsert',
  jsonb_build_object(
    'id', a."id"::text, 'label', a."label", 'type', a."type"::text,
    'institution', a."institution", 'currency', a."currency",
    'startingBalance', a."starting_balance"::text, 'color', a."color", 'icon', a."icon",
    'isArchived', a."is_archived", 'updatedAt', to_char(a."updated_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
FROM "accounts" a;

INSERT INTO "mobile_sync_changes" ("user_id", "entity", "record_id", "operation", "data")
SELECT
  c."user_id", 'category', c."id", 'upsert',
  jsonb_build_object(
    'id', c."id"::text, 'name', c."name", 'type', c."type"::text,
    'parentId', c."parent_id"::text, 'icon', c."icon", 'color', c."color", 'bucket', c."bucket"::text,
    'updatedAt', to_char(c."updated_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
FROM "categories" c;

INSERT INTO "mobile_sync_changes" ("user_id", "entity", "record_id", "operation", "data")
SELECT
  t."user_id", 'transaction', t."id", 'upsert',
  jsonb_build_object(
    'id', t."id"::text, 'accountId', t."account_id"::text, 'categoryId', t."category_id"::text,
    'bucket', t."bucket"::text, 'amount', t."amount"::text, 'type', t."type"::text,
    'destinationAccountId', destination."account_id"::text, 'date', to_char(t."date", 'YYYY-MM-DD'),
    'note', t."note", 'updatedAt', to_char(t."updated_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
FROM "transactions" t
LEFT JOIN "transactions" destination
  ON destination."transfer_group_id" = t."transfer_group_id"
  AND destination."transfer_role" = 'incoming'
WHERE t."type" <> 'transfer' OR t."transfer_role" = 'outgoing';
