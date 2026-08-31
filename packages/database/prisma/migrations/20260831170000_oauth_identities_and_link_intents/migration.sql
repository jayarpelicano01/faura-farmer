-- OAuth identities support multiple providers per user. Link intents are
-- short-lived and single-use; their cookie binding is enforced by the app.
BEGIN;

CREATE TABLE "oauth_identities" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_identities_provider_provider_account_id_key"
ON "oauth_identities"("provider", "provider_account_id");

CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");

ALTER TABLE "oauth_identities"
ADD CONSTRAINT "oauth_identities_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing Google/Facebook login mappings before new
-- authorization decisions switch to oauth_identities. Reusing the legacy
-- user UUID avoids requiring a database UUID-generation extension.
INSERT INTO "oauth_identities" (
  "id", "user_id", "provider", "provider_account_id", "created_at"
)
SELECT "id", "id", "auth_provider", "provider_id", "created_at"
FROM "users"
WHERE "auth_provider" IN ('google', 'facebook')
  AND "provider_id" IS NOT NULL
ON CONFLICT ("provider", "provider_account_id") DO NOTHING;

CREATE TABLE "oauth_link_intents" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_link_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "oauth_link_intents_user_id_provider_expires_at_idx"
ON "oauth_link_intents"("user_id", "provider", "expires_at");

ALTER TABLE "oauth_link_intents"
ADD CONSTRAINT "oauth_link_intents_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
