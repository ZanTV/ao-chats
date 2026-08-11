import { prisma } from '../config/database';

/** Idempotent SQL aligned with prisma/migrations — safe to run on every production boot. */
const SCHEMA_PATCHES = [
  `ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "cleared_at" TIMESTAMP(3)`,
  `ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_attempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_sent_at" TIMESTAMP(3)`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMP(3)`,
  // Unique index is applied by merge-duplicate-direct-conversations.mjs after dedupe.
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "direct_pair_key" TEXT`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment" JSONB`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_version" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "profile_gallery_photos" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "storage_key" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "file_name" TEXT NOT NULL,
      "mime_type" TEXT NOT NULL,
      "file_size" INTEGER NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "profile_gallery_photos_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  `CREATE INDEX IF NOT EXISTS "profile_gallery_photos_user_id_idx" ON "profile_gallery_photos"("user_id")`,
] as const;

export async function ensureProductionSchema(): Promise<void> {
  for (const sql of SCHEMA_PATCHES) {
    await prisma.$executeRawUnsafe(sql);
  }
}

export async function isAuthSchemaReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT reset_attempts, reset_sent_at FROM users LIMIT 0`;
    return true;
  } catch {
    return false;
  }
}

export async function isChatSchemaReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT cleared_at, hidden_at FROM participants LIMIT 0`;
    return true;
  } catch {
    return false;
  }
}

export async function isProductionSchemaReady(): Promise<boolean> {
  const [auth, chat] = await Promise.all([isAuthSchemaReady(), isChatSchemaReady()]);
  return auth && chat;
}
