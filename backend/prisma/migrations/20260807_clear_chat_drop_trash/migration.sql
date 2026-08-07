-- Add per-user chat clear timestamp
ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "cleared_at" TIMESTAMP(3);

-- Remove message trash audit table (deletes are soft-hide only)
DROP TABLE IF EXISTS "message_trash";
