import { prisma } from '../config/database';
import { AO_MANAGER } from '../config';
import { hashPassword } from '../utils/auth.utils';

export async function ensureAoManagerAccount(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: AO_MANAGER.username },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isVerified: true,
        isSystemAccount: true,
        emailVerified: true,
        status: 'ONLINE',
      },
    });
    return existing.id;
  }

  const passwordHash = await hashPassword(
    process.env.AO_MANAGER_PASSWORD || 'ao-manager-system-account-no-login'
  );

  const user = await prisma.user.create({
    data: {
      email: AO_MANAGER.email,
      username: AO_MANAGER.username,
      passwordHash,
      firstName: AO_MANAGER.firstName,
      lastName: AO_MANAGER.lastName,
      avatarId: AO_MANAGER.avatarId,
      bio: AO_MANAGER.bio,
      statusMessage: AO_MANAGER.statusMessage,
      emailVerified: true,
      isVerified: true,
      isSystemAccount: true,
      status: 'ONLINE',
    },
    select: { id: true },
  });

  console.log('✓ AO Manager system account created');
  return user.id;
}

export async function getAoManagerId(): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { username: AO_MANAGER.username },
    select: { id: true },
  });
  return user?.id ?? null;
}
