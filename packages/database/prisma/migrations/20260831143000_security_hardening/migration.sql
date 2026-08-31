-- Security hardening: session revocation, OAuth identities, tenant ownership,
-- password reset tokens, audit events, transfer integrity, and RLS policies.
--
-- Apply only after a staging rehearsal. RLS policies require the application
-- database role to be non-owner/non-BYPASSRLS and each request transaction to
-- set `app.user_id` before querying tenant tables.

BEGIN;

ALTER TABLE "users"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
ADD CONSTRAINT "users_session_version_nonnegative_check" CHECK ("session_version" >= 0);

CREATE UNIQUE INDEX "users_auth_provider_provider_id_key"
ON "users"("auth_provider", "provider_id");

ALTER TABLE "transactions"
ADD COLUMN "user_id" UUID;

UPDATE "transactions" AS transaction
SET "user_id" = account."user_id"
FROM "accounts" AS account
WHERE transaction."account_id" = account."id";

ALTER TABLE "transactions"
ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "recurring_rules"
ADD COLUMN "user_id" UUID;

UPDATE "recurring_rules" AS rule
SET "user_id" = account."user_id"
FROM "accounts" AS account
WHERE rule."account_id" = account."id";

ALTER TABLE "recurring_rules"
ALTER COLUMN "user_id" SET NOT NULL;

CREATE UNIQUE INDEX "accounts_id_user_id_key" ON "accounts"("id", "user_id");
CREATE UNIQUE INDEX "categories_id_user_id_key" ON "categories"("id", "user_id");

CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date");
CREATE INDEX "transactions_account_id_transfer_role_transfer_group_id_idx"
ON "transactions"("account_id", "transfer_role", "transfer_group_id");
CREATE INDEX "recurring_rules_user_id_idx" ON "recurring_rules"("user_id");

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_account_id_user_id_fkey"
FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_rules"
ADD CONSTRAINT "recurring_rules_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_rules"
ADD CONSTRAINT "recurring_rules_account_id_user_id_fkey"
FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budgets"
ADD CONSTRAINT "budgets_category_id_user_id_fkey"
FOREIGN KEY ("category_id", "user_id") REFERENCES "categories"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "categories" AS child
    JOIN "categories" AS parent ON parent."id" = child."parent_id"
    WHERE child."user_id" <> parent."user_id"
  ) THEN
    RAISE EXCEPTION 'Cannot apply security hardening: cross-user category parents exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "transactions" AS transaction
    JOIN "categories" AS category ON category."id" = transaction."category_id"
    WHERE transaction."user_id" <> category."user_id"
  ) THEN
    RAISE EXCEPTION 'Cannot apply security hardening: cross-user transaction categories exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "recurring_rules" AS rule
    JOIN "categories" AS category ON category."id" = rule."category_id"
    WHERE rule."user_id" <> category."user_id"
  ) THEN
    RAISE EXCEPTION 'Cannot apply security hardening: cross-user recurring-rule categories exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "transactions" AS transaction
    JOIN "accounts" AS account ON account."id" = transaction."account_id"
    WHERE transaction."transfer_group_id" IS NOT NULL
    GROUP BY transaction."transfer_group_id"
    HAVING COUNT(*) <> 2
      OR COUNT(*) FILTER (WHERE transaction."transfer_role" = 'outgoing') <> 1
      OR COUNT(*) FILTER (WHERE transaction."transfer_role" = 'incoming') <> 1
      OR COUNT(DISTINCT transaction."user_id") <> 1
      OR COUNT(DISTINCT transaction."account_id") <> 2
      OR COUNT(DISTINCT transaction."amount") <> 1
      OR COUNT(DISTINCT account."currency") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply security hardening: invalid transfer groups exist';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "assert_category_parent_owner"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."parent_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "categories" AS parent
    WHERE parent."id" = NEW."parent_id"
      AND parent."user_id" = NEW."user_id"
  ) THEN
    RAISE EXCEPTION 'Category parent must belong to the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "categories_parent_owner_trigger"
BEFORE INSERT OR UPDATE OF "parent_id", "user_id" ON "categories"
FOR EACH ROW EXECUTE FUNCTION "assert_category_parent_owner"();

CREATE OR REPLACE FUNCTION "assert_transaction_category_owner"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."category_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "categories" AS category
    WHERE category."id" = NEW."category_id"
      AND category."user_id" = NEW."user_id"
  ) THEN
    RAISE EXCEPTION 'Transaction category must belong to the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "transactions_category_owner_trigger"
BEFORE INSERT OR UPDATE OF "category_id", "user_id" ON "transactions"
FOR EACH ROW EXECUTE FUNCTION "assert_transaction_category_owner"();

CREATE OR REPLACE FUNCTION "assert_recurring_rule_category_owner"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."category_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "categories" AS category
    WHERE category."id" = NEW."category_id"
      AND category."user_id" = NEW."user_id"
  ) THEN
    RAISE EXCEPTION 'Recurring-rule category must belong to the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "recurring_rules_category_owner_trigger"
BEFORE INSERT OR UPDATE OF "category_id", "user_id" ON "recurring_rules"
FOR EACH ROW EXECUTE FUNCTION "assert_recurring_rule_category_owner"();

CREATE OR REPLACE FUNCTION "assert_transfer_group_integrity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  group_id UUID := COALESCE(NEW."transfer_group_id", OLD."transfer_group_id");
  row_count INTEGER;
  outgoing_count INTEGER;
  incoming_count INTEGER;
  owner_count INTEGER;
  account_count INTEGER;
  amount_count INTEGER;
  currency_count INTEGER;
BEGIN
  IF group_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE transaction."transfer_role" = 'outgoing'),
    COUNT(*) FILTER (WHERE transaction."transfer_role" = 'incoming'),
    COUNT(DISTINCT transaction."user_id"),
    COUNT(DISTINCT transaction."account_id"),
    COUNT(DISTINCT transaction."amount"),
    COUNT(DISTINCT account."currency")
  INTO row_count, outgoing_count, incoming_count, owner_count, account_count, amount_count, currency_count
  FROM "transactions" AS transaction
  JOIN "accounts" AS account ON account."id" = transaction."account_id"
  WHERE transaction."transfer_group_id" = group_id;

  IF row_count <> 0 AND (
    row_count <> 2
    OR outgoing_count <> 1
    OR incoming_count <> 1
    OR owner_count <> 1
    OR account_count <> 2
    OR amount_count <> 1
    OR currency_count <> 1
  ) THEN
    RAISE EXCEPTION 'Transfer groups must have exactly one balanced outgoing and incoming leg for one user';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "transactions_transfer_group_integrity_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_transfer_group_integrity"();

CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_events" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "event" TEXT NOT NULL,
  "ip_hash" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");
CREATE INDEX "security_events_event_created_at_idx" ON "security_events"("event", "created_at");

ALTER TABLE "security_events"
ADD CONSTRAINT "security_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "app_current_user_id"()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::UUID
$$;

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurring_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_tenant_isolation" ON "accounts"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "categories_tenant_isolation" ON "categories"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "transactions_tenant_isolation" ON "transactions"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "recurring_rules_tenant_isolation" ON "recurring_rules"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "budgets_tenant_isolation" ON "budgets"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "goals_tenant_isolation" ON "goals"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "monthly_budgets_tenant_isolation" ON "monthly_budgets"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "password_reset_tokens_tenant_isolation" ON "password_reset_tokens"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());
CREATE POLICY "security_events_tenant_isolation" ON "security_events"
FOR ALL USING ("user_id" = "app_current_user_id"()) WITH CHECK ("user_id" = "app_current_user_id"());

COMMIT;
