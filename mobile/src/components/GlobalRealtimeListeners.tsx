import { useEffect } from 'react';
import { socketService } from '../services/socket';
import { useTypingStore } from '../stores/typingStore';
import { useAuthStore } from '../stores/authStore';
import { cacheManager } from '../cache';

/** Subscribes to app-wide socket events (typing, etc.) outside individual screens. */
export function GlobalRealtimeListeners() {
  const { isAuthenticated, user } = useAuthStore();
  const setTyping = useTypingStore((s) => s.setTyping);

  useEffect(() => {
    if (!isAuthenticated) return;

    socketService.connect();

    const unsubs = [
      socketService.on('typing:start', (data: unknown) => {
        const { conversationId, userId } = data as { conversationId: string; userId: string };
        if (userId !== user?.id) {
          setTyping(conversationId, true);
        }
      }),
      socketService.on('typing:stop', (data: unknown) => {
        const { conversationId } = data as { conversationId: string };
        setTyping(conversationId, false);
      }),
      // Keep local message cache in sync even when chat screen is closed
      socketService.on('message:delete', (data: unknown) => {
        const payload = data as {
          messageId?: string;
          conversationId?: string;
          forEveryone?: boolean;
          userId?: string;
        };
        if (!payload.messageId || !payload.conversationId) return;
        const hideForMe = payload.forEveryone || payload.userId === user?.id;
        if (!hideForMe) return;
        cacheManager.deleteMessages(payload.conversationId, [payload.messageId]).catch(() => {});
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isAuthenticated, user?.id, setTyping]);

  return null;
}
