import type { MessageInput } from './chat.schemas.js';
export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  requestId: string;
  position: number;
  mode: string;
  createdAt: string;
}
export interface ChatSession {
  id: string;
  roadmapId: string | null;
  title: string;
  version: number;
  updatedAt: string;
}
export interface HistoryPage {
  session: ChatSession;
  messages: ChatMessage[];
  nextBefore: number | null;
}
export interface TurnReservation {
  session: ChatSession;
  token: string | null;
  cached: ChatMessage[] | null;
  history: ChatMessage[];
}
export interface ChatRepository {
  sessions(userId: string): Promise<ChatSession[]>;
  session(userId: string, id: string): Promise<ChatSession>;
  history(userId: string, id: string, limit: number, before?: number): Promise<HistoryPage>;
  reserve(
    userId: string,
    input: MessageInput,
    roadmapId: string | null,
    now: Date,
  ): Promise<TurnReservation>;
  complete(
    userId: string,
    input: MessageInput,
    reservation: TurnReservation,
    content: string,
    mode: string,
  ): Promise<{ session: ChatSession; messages: ChatMessage[] }>;
  release(userId: string, sessionId: string, token: string): Promise<void>;
  delete(userId: string, sessionId?: string): Promise<void>;
}
