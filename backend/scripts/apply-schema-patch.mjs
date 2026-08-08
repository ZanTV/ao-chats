import { PrismaClient } from '@prisma/client';

await import('./prepare-env.mjs');

/** Idempotent patches from prisma/migrations — safe on production. */
const patches = [
  `ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "cleared_at" TIMESTAMP(3)`,
  `ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_attempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_sent_at" TIMESTAMP(3)`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMP(3)`,
];

const prisma = new PrismaClient();

try {
  for (const sql of patches) {
    await prisma.$executeRawUnsafe(sql);
    console.log('✓ Applied patch');
  }
  await prisma.$queryRaw`SELECT cleared_at, hidden_at FROM participants LIMIT 0`;
  console.log('✓ Chat schema ready');
} catch (err) {
  console.error('✗ Schema patch failed:', err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
