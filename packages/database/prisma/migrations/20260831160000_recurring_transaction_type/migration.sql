-- Recurring rules can produce either income or expense transactions.
-- Existing rules retain the historic expense behavior.
BEGIN;

ALTER TABLE "recurring_rules"
ADD COLUMN "type" "TransactionType" NOT NULL DEFAULT 'expense';

ALTER TABLE "recurring_rules"
ADD CONSTRAINT "recurring_rules_type_nontransfer_check"
CHECK ("type" IN ('income', 'expense'));

CREATE UNIQUE INDEX "recurring_rules_id_user_id_key"
ON "recurring_rules"("id", "user_id");

CREATE INDEX "recurring_rules_user_id_is_active_next_due_date_idx"
ON "recurring_rules"("user_id", "is_active", "next_due_date");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "transactions" AS transaction
    JOIN "recurring_rules" AS rule ON rule."id" = transaction."recurring_rule_id"
    WHERE transaction."user_id" <> rule."user_id"
  ) THEN
    RAISE EXCEPTION 'Cannot add recurring transaction ownership constraint: cross-user references exist';
  END IF;
END;
$$;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_recurring_rule_id_user_id_fkey"
FOREIGN KEY ("recurring_rule_id", "user_id")
REFERENCES "recurring_rules"("id", "user_id")
ON DELETE SET NULL ("recurring_rule_id")
ON UPDATE CASCADE;

COMMIT;
