-- Dedicated debt ledger. This migration defines new tables only and does not
-- alter existing accounts, transactions, reports, or historical fake accounts.
BEGIN;

CREATE TYPE "DebtDirection" AS ENUM ('receivable', 'payable');
CREATE TYPE "DebtStatus" AS ENUM ('open', 'partially_paid', 'paid', 'written_off');

CREATE TABLE "persons" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "contact" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "debts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "person_id" UUID NOT NULL,
  "direction" "DebtDirection" NOT NULL,
  "original_principal" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "DebtStatus" NOT NULL DEFAULT 'open',
  "opened_at" DATE NOT NULL DEFAULT CURRENT_DATE,
  "due_date" DATE,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debts_original_principal_positive_check" CHECK ("original_principal" > 0),
  CONSTRAINT "debts_currency_check" CHECK ("currency" IN ('PHP', 'USD'))
);

CREATE TABLE "debt_adjustments" (
  "id" UUID NOT NULL,
  "debt_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debt_adjustments_amount_nonzero_check" CHECK ("amount" <> 0)
);

CREATE TABLE "debt_payments" (
  "id" UUID NOT NULL,
  "debt_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "date" DATE NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debt_payments_amount_positive_check" CHECK ("amount" > 0)
);

CREATE TABLE "debt_cash_events" (
  "id" UUID NOT NULL,
  "debt_id" UUID NOT NULL,
  "payment_id" UUID,
  "account_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "direction" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_cash_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debt_cash_events_payment_id_key" UNIQUE ("payment_id"),
  CONSTRAINT "debt_cash_events_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "debt_cash_events_direction_check" CHECK ("direction" IN ('in', 'out'))
);

CREATE INDEX "persons_user_id_idx" ON "persons"("user_id");
CREATE UNIQUE INDEX "persons_id_user_id_key" ON "persons"("id", "user_id");
CREATE INDEX "debts_user_id_idx" ON "debts"("user_id");
CREATE INDEX "debts_person_id_idx" ON "debts"("person_id");
CREATE INDEX "debts_user_id_status_idx" ON "debts"("user_id", "status");
CREATE UNIQUE INDEX "debts_id_user_id_key" ON "debts"("id", "user_id");
CREATE INDEX "debt_adjustments_debt_id_idx" ON "debt_adjustments"("debt_id");
CREATE INDEX "debt_payments_debt_id_idx" ON "debt_payments"("debt_id");
CREATE INDEX "debt_cash_events_debt_id_idx" ON "debt_cash_events"("debt_id");
CREATE INDEX "debt_cash_events_account_id_idx" ON "debt_cash_events"("account_id");

ALTER TABLE "persons"
  ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debts"
  ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "debts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debt_adjustments"
  ADD CONSTRAINT "debt_adjustments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debt_payments"
  ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debt_cash_events"
  ADD CONSTRAINT "debt_cash_events_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "debt_cash_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "debt_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "debt_cash_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
