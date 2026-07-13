import 'server-only';
import type { ChatMessage } from '@/lib/bedrock/converse';

export interface Conversation {
  id: string;
  userId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

/** Persistence seam: v1 keeps history client-side; a DynamoDB impl slots in
 *  behind this interface without API changes. */
export interface ConversationStore {
  get(userId: string, conversationId: string): Promise<Conversation | undefined>;
  put(conversation: Conversation): Promise<void>;
  delete(userId: string, conversationId: string): Promise<void>;
}

class InMemoryConversationStore implements ConversationStore {
  private conversations = new Map<string, Conversation>();

  private key(userId: string, conversationId: string) {
    return `${userId}:${conversationId}`;
  }

  async get(userId: string, conversationId: string) {
    return this.conversations.get(this.key(userId, conversationId));
  }

  async put(conversation: Conversation) {
    this.conversations.set(
      this.key(conversation.userId, conversation.id),
      conversation
    );
  }

  async delete(userId: string, conversationId: string) {
    this.conversations.delete(this.key(userId, conversationId));
  }
}

export const conversationStore: ConversationStore =
  new InMemoryConversationStore();
