import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './storage';
import { getSocketUrl, isProduction } from './config';

type EventCallback = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventCallback>>();

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await getAccessToken();
    if (!token) return;

    this.socket = io(getSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: isProduction() ? 20 : 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
    });

    this.socket.on('connect', () => {
      if (!isProduction()) console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      if (!isProduction()) console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      if (!isProduction()) console.warn('Socket connect error:', err.message);
    });

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => this.socket?.on(event, cb));
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    };
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }

  joinConversation(conversationId: string): void {
    this.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.emit('conversation:leave', conversationId);
  }

  sendMessage(data: {
    conversationId: string;
    content: string;
    replyToId?: string;
    tempId?: string;
  }): void {
    this.emit('message:send', data);
  }

  startTyping(conversationId: string): void {
    this.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.emit('typing:stop', { conversationId });
  }

  markRead(conversationId: string): void {
    this.emit('message:read', { conversationId });
  }

  markDelivered(messageId: string, conversationId: string): void {
    this.emit('message:delivered', { messageId, conversationId });
  }

  unpinMessage(messageId: string, conversationId: string): void {
    this.emit('message:unpin', { messageId, conversationId });
  }

  starMessage(messageId: string, conversationId: string): void {
    this.emit('message:star', { messageId, conversationId });
  }

  unstarMessage(messageId: string, conversationId: string): void {
    this.emit('message:unstar', { messageId, conversationId });
  }

  react(messageId: string, emoji: string, conversationId: string): void {
    this.emit('message:react', { messageId, emoji, conversationId });
  }

  deleteMessage(messageId: string, conversationId: string, forEveryone: boolean): void {
    this.emit('message:delete', { messageId, conversationId, forEveryone });
  }

  pinMessage(messageId: string, conversationId: string): void {
    this.emit('message:pin', { messageId, conversationId });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
