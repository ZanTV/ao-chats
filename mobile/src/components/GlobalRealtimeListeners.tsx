import { useEffect } from 'react';
import { socketService } from '../services/socket';
import { useTypingStore } from '../stores/typingStore';
import { useAuthStore } from '../stores/authStore';

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
    ];

    return () => unsubs.forEach((u) => u());
  }, [isAuthenticated, user?.id, setTyping]);

  return null;
}
