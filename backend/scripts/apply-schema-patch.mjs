import { PrismaClient } from '@prisma/client';

await import('./prepare-env.mjs');

const patches = [
  `ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_attempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_sent_at" TIMESTAMP(3)`,
];

const prisma = new PrismaClient();

try {
  for (const sql of patches) {
    await prisma.$executeRawUnsafe(sql);
    console.log('✓ Applied patch');
  }
  await prisma.$queryRaw`SELECT reset_attempts, reset_sent_at FROM users LIMIT 0`;
  console.log('✓ Auth schema ready');
} catch (err) {
  console.error('✗ Schema patch failed:', err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
