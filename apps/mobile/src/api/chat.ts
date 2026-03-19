import { api } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const chatApi = {
  getHistory: () => api.get<{ messages: ChatMessage[] }>('/chat/history'),
  sendMessage: (message: string) =>
    api.post<{ message: string; timestamp: string }>('/chat/message', { message }),
  clearHistory: () => api.delete<void>('/chat/history'),
};
