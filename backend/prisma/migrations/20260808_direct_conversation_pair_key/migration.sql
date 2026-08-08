-- Canonical 1-to-1 pair key (nullable for groups).
-- Unique index is created by merge-duplicate-direct-conversations.mjs AFTER duplicates are merged.
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "direct_pair_key" TEXT;
