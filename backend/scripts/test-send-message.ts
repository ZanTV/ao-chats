import 'dotenv/config';
import { messageService } from '../src/modules/messages/message.service';
import { prisma } from '../src/config/database';

async function main() {
  const conv = await prisma.conversation.findFirst({
    include: { participants: true },
  });
  if (!conv) {
    console.log('No conversation');
    return;
  }

  const userId = conv.participants[0]?.userId;
  console.log('Testing send in conv', conv.id, 'as user', userId);

  try {
    const msg = await messageService.sendMessage(conv.id, userId, 'Test persistence message', 'TEXT');
    console.log('Saved message:', msg.id, msg.content);
  } catch (e) {
    console.error('Send failed:', e instanceof Error ? e.message : e);
  }

  const count = await prisma.message.count({ where: { conversationId: conv.id } });
  console.log('Messages in conv after send:', count);
}

main().finally(() => prisma.$disconnect());
