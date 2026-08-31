-- Private receipt metadata. Binary objects remain in the configured private
-- Supabase Storage bucket; this table enforces the same tenant ownership as transactions.
BEGIN;

CREATE UNIQUE INDEX "transactions_id_user_id_key"
ON "transactions"("id", "user_id");

CREATE TABLE "transaction_attachments" (
  "id" UUID NOT NULL,
  "transaction_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "storage_path" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "transaction_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_attachments_storage_path_key" UNIQUE ("storage_path"),
  CONSTRAINT "transaction_attachments_mime_type_check"
    CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "transaction_attachments_file_size_check"
    CHECK ("file_size" > 0 AND "file_size" <= 10485760)
);

CREATE INDEX "transaction_attachments_transaction_id_idx"
ON "transaction_attachments"("transaction_id");
CREATE INDEX "transaction_attachments_user_id_transaction_id_idx"
ON "transaction_attachments"("user_id", "transaction_id");

ALTER TABLE "transaction_attachments"
ADD CONSTRAINT "transaction_attachments_transaction_id_user_id_fkey"
FOREIGN KEY ("transaction_id", "user_id")
REFERENCES "transactions"("id", "user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "assert_transaction_attachment_storage_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."storage_path" NOT LIKE
    ('receipts/' || NEW."user_id"::text || '/' || NEW."transaction_id"::text || '/%') THEN
    RAISE EXCEPTION 'Receipt storage path must be scoped to its user and transaction';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "transaction_attachments_storage_scope_trigger"
BEFORE INSERT OR UPDATE OF "storage_path", "user_id", "transaction_id" ON "transaction_attachments"
FOR EACH ROW EXECUTE FUNCTION "assert_transaction_attachment_storage_scope"();

ALTER TABLE "transaction_attachments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaction_attachments_tenant_isolation" ON "transaction_attachments"
FOR ALL USING ("user_id" = "app_current_user_id"())
WITH CHECK ("user_id" = "app_current_user_id"());

COMMIT;
