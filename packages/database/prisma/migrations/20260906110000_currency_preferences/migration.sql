-- Shared display preference only. Existing financial values stay in their saved currency.
ALTER TABLE "users" ADD COLUMN "display_currency" TEXT NOT NULL DEFAULT 'PHP';
ALTER TABLE "users" ADD COLUMN "usd_per_php" DECIMAL(20, 10);
ALTER TABLE "users" ADD COLUMN "rate_date" DATE;
ALTER TABLE "users" ADD COLUMN "rate_refreshed_at" TIMESTAMPTZ(6);
