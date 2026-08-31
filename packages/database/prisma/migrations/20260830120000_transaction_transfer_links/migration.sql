-- Link the two ledger rows that make up an account-to-account transfer.
-- Existing transfer rows remain unlinked and retain their legacy debit behavior.
BEGIN;

CREATE TYPE "TransferRole" AS ENUM ('outgoing', 'incoming');

ALTER TABLE "transactions"
ADD COLUMN "transfer_group_id" UUID,
ADD COLUMN "transfer_role" "TransferRole";

CREATE INDEX "transactions_transfer_group_id_idx"
ON "transactions"("transfer_group_id");

CREATE UNIQUE INDEX "transactions_transfer_group_id_transfer_role_key"
ON "transactions"("transfer_group_id", "transfer_role");

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_transfer_link_consistency_check"
CHECK (
  (
    "type" = 'transfer'
    AND (
      ("transfer_group_id" IS NULL AND "transfer_role" IS NULL)
      OR ("transfer_group_id" IS NOT NULL AND "transfer_role" IS NOT NULL)
    )
  )
  OR (
    "type" <> 'transfer'
    AND "transfer_group_id" IS NULL
    AND "transfer_role" IS NULL
  )
);

COMMIT;
