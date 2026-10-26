import type { ChatSession, ChatMessage } from '@/features/chat/chat.api';
export const chatSession: ChatSession = {
  id: '80000000-0000-4000-8000-000000000001',
  roadmapId: null,
  title: 'General learning',
  version: 2,
  updatedAt: '2026-10-27T00:00:00.000Z',
};
export const chatMessages: ChatMessage[] = [
  {
    id: '81000000-0000-4000-8000-000000000001',
    role: 'USER',
    content: 'What should I work on next?',
    requestId: '82000000-0000-4000-8000-000000000001',
    position: 0,
    mode: 'user',
    createdAt: '2026-10-27T00:00:00.000Z',
  },
  {
    id: '81000000-0000-4000-8000-000000000002',
    role: 'ASSISTANT',
    content: 'Review your React roadmap and try one small exercise.',
    requestId: '82000000-0000-4000-8000-000000000001',
    position: 1,
    mode: 'offline',
    createdAt: '2026-10-27T00:00:00.000Z',
  },
];
