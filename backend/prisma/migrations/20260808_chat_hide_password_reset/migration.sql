-- Per-user chat list hide + password reset security fields
ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_sent_at" TIMESTAMP(3);
