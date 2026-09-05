'use client';

import { Message } from '@/types/conversation';
import { MessageList } from './MessageList';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface ConversationAreaProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function ConversationArea({ messages, isStreaming }: ConversationAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', 'bg-slate-50 dark:bg-slate-950')}>
      <MessageList messages={messages} isStreaming={isStreaming} scrollRef={scrollRef} />
    </div>
  );
}