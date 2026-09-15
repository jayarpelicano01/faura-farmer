-- Hidden debts remain in the ledger and dashboard calculations. Applying this
-- migration is a user-controlled action and is not part of local development.
BEGIN;

ALTER TABLE "debts"
  ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "debts_user_id_is_hidden_idx"
  ON "debts"("user_id", "is_hidden");

COMMIT;
