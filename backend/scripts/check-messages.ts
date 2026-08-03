import 'dotenv/config';
import { prisma } from '../src/config/database';

async function main() {
  const total = await prisma.message.count();
  console.log('Total messages in DB:', total);

  const conversations = await prisma.conversation.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
      messages: { take: 3, orderBy: { createdAt: 'desc' } },
    },
  });

  for (const c of conversations) {
    console.log(`Conv ${c.id}: ${c._count.messages} messages`);
    for (const m of c.messages) {
      console.log(`  - [${m.createdAt.toISOString()}] ${m.content.slice(0, 40)}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
