import { marked } from 'marked';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === 'user';

  const renderContent = () => {
    if (isUser) {
      return <div className="whitespace-pre-wrap">{message.content}</div>;
    }

    // Render markdown for assistant messages
    const html = marked(message.content);
    return (
      <div
        className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg ${
          isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900 border'
        }`}
      >
        {renderContent()}
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
