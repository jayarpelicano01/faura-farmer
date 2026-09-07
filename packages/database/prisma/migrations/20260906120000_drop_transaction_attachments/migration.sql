-- DropTable
ALTER TABLE "transaction_attachments" DROP CONSTRAINT "transaction_attachments_transaction_id_user_id_fkey";

-- DropIndex
DROP INDEX "transaction_attachments_user_id_transaction_id_idx";

-- DropIndex
DROP INDEX "transaction_attachments_transaction_id_idx";

-- DropIndex
DROP INDEX "transaction_attachments_storage_path_key";

-- DropIndex
DROP INDEX "transaction_attachments_pkey";

-- DropTable
DROP TABLE "transaction_attachments";
