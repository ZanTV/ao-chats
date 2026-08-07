import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../config/database';

const expo = new Expo();

export async function registerPushToken(
  userId: string,
  token: string,
  platform?: string
): Promise<void> {
  if (!Expo.isExpoPushToken(token)) return;

  await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  });
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { userId, token } });
}

export async function sendPushToUser(
  userId: string,
  payload: Omit<ExpoPushMessage, 'to'>
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter((row: { token: string }) => Expo.isExpoPushToken(row.token))
    .map((row: { token: string }) => ({
      ...payload,
      to: row.token,
    }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const badToken = chunk[i]?.to;
          if (typeof badToken === 'string') {
            await prisma.pushToken.deleteMany({ where: { token: badToken } });
          }
        }
      }
    } catch (err) {
      console.warn('Push dispatch failed:', err instanceof Error ? err.message : err);
    }
  }
}
