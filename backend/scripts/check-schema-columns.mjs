import { PrismaClient } from '@prisma/client';

await import('./prepare-env.mjs');

  const checks = [
  { name: 'users.reset_attempts', sql: `SELECT reset_attempts FROM users LIMIT 0` },
  { name: 'users.reset_sent_at', sql: `SELECT reset_sent_at FROM users LIMIT 0` },
  { name: 'participants.cleared_at', sql: `SELECT cleared_at FROM participants LIMIT 0` },
  { name: 'participants.hidden_at', sql: `SELECT hidden_at FROM participants LIMIT 0` },
  { name: 'messages.is_edited', sql: `SELECT is_edited FROM messages LIMIT 0` },
  { name: 'messages.edited_at', sql: `SELECT edited_at FROM messages LIMIT 0` },
];

const prisma = new PrismaClient();

try {
  for (const check of checks) {
    try {
      await prisma.$queryRawUnsafe(check.sql);
      console.log(`OK  ${check.name}`);
    } catch (err) {
      console.log(`MISS ${check.name} — ${err instanceof Error ? err.message.split('\n')[0] : err}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
