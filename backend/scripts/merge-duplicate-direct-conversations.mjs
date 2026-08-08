/**
 * Safe merge of duplicate 1-to-1 conversations + backfill direct_pair_key.
 *
 * Usage:
 *   node scripts/merge-duplicate-direct-conversations.mjs           # dry-run
 *   node scripts/merge-duplicate-direct-conversations.mjs --apply   # apply
 *
 * NEVER uses prisma migrate reset. Preserves messages, replies, pins, stars.
 */
import { PrismaClient } from '@prisma/client';

await import('./prepare-env.mjs');

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

async function ensureColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "direct_pair_key" TEXT`
  );
}

async function loadDirectConversations() {
  return prisma.conversation.findMany({
    where: { isGroup: false },
    include: {
      participants: { select: { userId: true, isPinned: true, lastReadAt: true, clearedAt: true, hiddenAt: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function groupByPair(conversations) {
  /** @type {Map<string, typeof conversations>} */
  const groups = new Map();
  for (const c of conversations) {
    if (c.participants.length !== 2) continue;
    const [a, b] = c.participants.map((p) => p.userId);
    const key = pairKey(a, b);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return groups;
}

function pickSurvivor(list) {
  return [...list].sort((a, b) => {
    if (b._count.messages !== a._count.messages) return b._count.messages - a._count.messages;
    const bu = new Date(b.updatedAt).getTime();
    const au = new Date(a.updatedAt).getTime();
    if (bu !== au) return bu - au;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  })[0];
}

async function mergePair(key, list) {
  const survivor = pickSurvivor(list);
  const losers = list.filter((c) => c.id !== survivor.id);
  const report = {
    pair: key,
    canonical: survivor.id,
    duplicates: losers.map((c) => c.id),
    messagesMoved: 0,
    pinsMoved: 0,
    starsMoved: 0,
  };

  if (losers.length === 0) {
    if (APPLY && !survivor.directPairKey) {
      await prisma.conversation.update({
        where: { id: survivor.id },
        data: { directPairKey: key },
      });
    }
    return report;
  }

  for (const loser of losers) {
    const msgCount = await prisma.message.count({ where: { conversationId: loser.id } });
    report.messagesMoved += msgCount;

    if (!APPLY) continue;

    // Move messages (replyToId stays valid — same message IDs)
    await prisma.message.updateMany({
      where: { conversationId: loser.id },
      data: { conversationId: survivor.id },
    });

    // Pins: update conversationId; drop conflicts on (messageId, conversationId)
    const pins = await prisma.messagePin.findMany({ where: { conversationId: loser.id } });
    for (const pin of pins) {
      const clash = await prisma.messagePin.findUnique({
        where: {
          messageId_conversationId: {
            messageId: pin.messageId,
            conversationId: survivor.id,
          },
        },
      });
      if (clash) {
        await prisma.messagePin.delete({ where: { id: pin.id } });
      } else {
        await prisma.messagePin.update({
          where: { id: pin.id },
          data: { conversationId: survivor.id },
        });
        report.pinsMoved += 1;
      }
    }

    // Stars
    const stars = await prisma.starredMessage.findMany({ where: { conversationId: loser.id } });
    for (const star of stars) {
      await prisma.starredMessage.update({
        where: { id: star.id },
        data: { conversationId: survivor.id },
      });
      report.starsMoved += 1;
    }

    // Notifications JSON data.conversationId
    await prisma.$executeRawUnsafe(
      `UPDATE "notifications"
       SET "data" = jsonb_set(COALESCE("data"::jsonb, '{}'::jsonb), '{conversationId}', to_jsonb($1::text), true)
       WHERE "data" IS NOT NULL
         AND ("data"::jsonb->>'conversationId') = $2`,
      survivor.id,
      loser.id
    );

    // Merge participant flags onto survivor, then delete loser participants + conversation
    for (const lp of loser.participants) {
      const sp = survivor.participants.find((p) => p.userId === lp.userId);
      if (!sp) {
        await prisma.participant.create({
          data: {
            conversationId: survivor.id,
            userId: lp.userId,
            isPinned: lp.isPinned,
            lastReadAt: lp.lastReadAt,
            clearedAt: lp.clearedAt,
            hiddenAt: lp.hiddenAt,
          },
        });
        continue;
      }
      await prisma.participant.update({
        where: {
          conversationId_userId: { conversationId: survivor.id, userId: lp.userId },
        },
        data: {
          isPinned: sp.isPinned || lp.isPinned,
          lastReadAt:
            sp.lastReadAt && lp.lastReadAt
              ? sp.lastReadAt > lp.lastReadAt
                ? sp.lastReadAt
                : lp.lastReadAt
              : sp.lastReadAt || lp.lastReadAt,
          // Keep chat visible if either side had not hidden it
          hiddenAt: sp.hiddenAt && lp.hiddenAt
            ? (sp.hiddenAt > lp.hiddenAt ? sp.hiddenAt : lp.hiddenAt)
            : null,
          // Prefer not clearing history if either participation was uncleaned
          clearedAt: !sp.clearedAt || !lp.clearedAt
            ? null
            : (sp.clearedAt < lp.clearedAt ? sp.clearedAt : lp.clearedAt),
        },
      });
    }

    await prisma.participant.deleteMany({ where: { conversationId: loser.id } });
    await prisma.conversation.delete({ where: { id: loser.id } });
  }

  if (APPLY) {
    const latestMsg = await prisma.message.findFirst({
      where: { conversationId: survivor.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    await prisma.conversation.update({
      where: { id: survivor.id },
      data: {
        directPairKey: key,
        ...(latestMsg?.createdAt ? { updatedAt: latestMsg.createdAt } : {}),
      },
    });
  }

  return report;
}

async function backfillKeys() {
  const conversations = await loadDirectConversations();
  let filled = 0;
  for (const c of conversations) {
    if (c.participants.length !== 2) continue;
    const key = pairKey(c.participants[0].userId, c.participants[1].userId);
    if (c.directPairKey === key) continue;
    if (!APPLY) {
      filled += 1;
      continue;
    }
    try {
      await prisma.conversation.update({
        where: { id: c.id },
        data: { directPairKey: key },
      });
      filled += 1;
    } catch (err) {
      console.warn(`Could not set key on ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return filled;
}

async function ensureUniqueIndex() {
  if (!APPLY) return;
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "conversations_direct_pair_key_key"
      ON "conversations" ("direct_pair_key")
  `);
}

async function invalidateCaches(userIds) {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl || userIds.size === 0) {
    console.log('Redis cache skip (no REDIS_URL or no users).');
    return;
  }
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      retryStrategy: () => null,
    });
    redis.on('error', () => {});
    await redis.connect();
    const keys = [...userIds].flatMap((id) => [
      `conversations:${id}`,
      `conversations:${id}:version`,
    ]);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    console.log(`Invalidated conversation cache for ${userIds.size} user(s).`);
  } catch (err) {
    console.warn('Redis invalidate failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log(APPLY ? '=== APPLY MODE ===' : '=== DRY RUN (pass --apply to write) ===');
  await ensureColumn();

  const conversations = await loadDirectConversations();
  const groups = groupByPair(conversations);
  const duplicateGroups = [...groups.entries()].filter(([, list]) => list.length > 1);

  console.log(`Direct 2-party conversations: ${conversations.filter((c) => c.participants.length === 2).length}`);
  console.log(`Duplicate pairs: ${duplicateGroups.length}`);

  const affectedUsers = new Set();
  const reports = [];
  for (const [key, list] of duplicateGroups) {
    for (const c of list) {
      for (const p of c.participants) affectedUsers.add(p.userId);
    }
    const report = await mergePair(key, list);
    reports.push(report);
    console.log(
      JSON.stringify({
        pair: key,
        canonical: report.canonical,
        duplicates: report.duplicates,
        messagesMoved: report.messagesMoved,
        pinsMoved: report.pinsMoved,
        starsMoved: report.starsMoved,
      })
    );
  }

  // Also collect users from all DMs for key backfill cache bust
  for (const c of conversations) {
    if (c.participants.length === 2) {
      for (const p of c.participants) affectedUsers.add(p.userId);
    }
  }

  const filled = await backfillKeys();
  console.log(`Keys to backfill/updated: ${filled}`);

  await ensureUniqueIndex();
  console.log(APPLY ? 'Unique index ensured.' : 'Unique index skipped (dry-run).');

  if (APPLY) await invalidateCaches(affectedUsers);

  if (reports.length === 0) {
    console.log('No duplicate pairs found.');
  } else {
    console.log(`\nProcessed ${reports.length} duplicate pair(s).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
