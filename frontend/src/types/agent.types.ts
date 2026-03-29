export type ChatRole = 'user' | 'agent';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}
