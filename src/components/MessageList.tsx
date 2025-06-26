import { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { ApiKeyBanner } from './ApiKeyBanner';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  apiKey: string | null;
  onApiKeySet?: (key: string) => void;
}

export const MessageList = ({
  messages,
  isLoading,
  apiKey,
  onApiKeySet,
}: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {!apiKey && onApiKeySet && <ApiKeyBanner onApiKeySet={onApiKeySet} />}

      {messages.length === 0 && apiKey && (
        <div className="text-center text-gray-500 mt-8">
          <p>Start a conversation! Ask me anything.</p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="bg-gray-100 border rounded-lg px-4 py-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              ></div>
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
