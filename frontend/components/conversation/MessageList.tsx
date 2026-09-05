'use client';

import { Message } from '@/types/conversation';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { MessageItem } from './Message';
import { Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export function MessageList({ messages, isStreaming, scrollRef }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Bot className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
          Start a conversation
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Click the microphone or type a message to begin
        </p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 p-4 space-y-4">
      {messages.map((message, index) => (
        <MessageItem
          key={`${message.id}-${index}`}
          message={message}
          isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
        />
      ))}
      {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
            <Loader2 className="w-4 h-4 text-primary-600 dark:text-primary-400 animate-spin" />
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[75%]">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </ScrollArea>
  );
}