import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import type { Message } from '../types';
import { loadMessages, saveMessages, clearMessages } from '../utils/storage';
import { sendMessage } from '../utils/openai';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadMessages();
    setMessages(stored);

    const storedKey =
      import.meta.env.VITE_OPENAI_API_KEY ||
      localStorage.getItem('openai_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const handleApiKeySet = useCallback((key: string) => {
    setApiKey(key);
    localStorage.setItem('openai_api_key', key);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!apiKey) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        await sendMessage(
          [...messages, userMessage],
          apiKey,
          (chunk: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content += chunk;
              }
              return updated;
            });
          }
        );
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content =
              'Sorry, I encountered an error. Please try again.';
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, messages]
  );

  const handleClearChat = useCallback(() => {
    setMessages([]);
    clearMessages();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">Chat AI</h1>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            Clear Chat
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          apiKey={apiKey}
          onApiKeySet={handleApiKeySet}
        />

        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={!apiKey || isLoading}
        />
      </div>
    </div>
  );
};
