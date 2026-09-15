-- Idempotent receipts for portable financial-backup imports. This migration
-- creates only the receipt table. Applying it remains a user-controlled action.
BEGIN;

CREATE TABLE "backup_import_receipts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "backup_id" UUID NOT NULL,
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entity_counts" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'success',
  CONSTRAINT "backup_import_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "backup_import_receipts_user_id_backup_id_key"
  ON "backup_import_receipts"("user_id", "backup_id");
CREATE INDEX "backup_import_receipts_user_id_idx"
  ON "backup_import_receipts"("user_id");

ALTER TABLE "backup_import_receipts"
  ADD CONSTRAINT "backup_import_receipts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
