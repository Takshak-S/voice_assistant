export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: number;
  role: MessageRole;
  content: string;
  tool_name?: string;
  tool_call_id?: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  title?: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface ConversationListItem {
  id: number;
  title?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}