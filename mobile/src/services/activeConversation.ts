let activeConversationId: string | null = null;

export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}
