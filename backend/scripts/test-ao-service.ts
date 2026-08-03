import 'dotenv/config';
import { conversationService } from '../src/modules/conversations/conversation.service';
import { getAoManagerId } from '../src/services/ao-manager.service';
import { prisma } from '../src/config/database';

async function main() {
  const managerId = await getAoManagerId();
  console.log('managerId:', managerId);

  const user = await prisma.user.findFirst({
    where: { username: 'orto' },
    select: { id: true },
  });
  console.log('userId:', user?.id);

  if (user?.id) {
    const conv = await conversationService.getOrCreateAoManagerConversation(user.id);
    console.log('conversation id:', conv.id);
    console.log('participants:', conv.participants?.length);
  }
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
