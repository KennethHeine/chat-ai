import type { Message } from '../types';

const STORAGE_KEY = 'chat-ai-messages';

export const loadMessages = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return parsed.map((msg: Message) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Failed to load messages from localStorage:', error);
    return [];
  }
};

export const saveMessages = (messages: Message[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save messages to localStorage:', error);
  }
};

export const clearMessages = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear messages from localStorage:', error);
  }
};
