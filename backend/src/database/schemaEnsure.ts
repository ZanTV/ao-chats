import { prisma } from '../config/database';

/** Idempotent SQL aligned with prisma/migrations — safe to run on every production boot. */
const SCHEMA_PATCHES = [
  `ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_attempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_sent_at" TIMESTAMP(3)`,
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
