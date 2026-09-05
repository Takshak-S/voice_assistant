'use client';

import { Message } from '@/types/conversation';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils';
import { Bot, User, Cpu, Loader2 } from 'lucide-react';

interface MessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageItem({ message, isStreaming }: MessageProps) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  return (
    <div
      className={cn(
        'flex gap-3 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {!isUser && (
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
            isTool ? 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
          )}
          aria-hidden="true"
        >
          {isTool ? <Cpu className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
      )}

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-bl-md'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {isStreaming && <span className="inline-block animate-pulse text-primary-400">▌</span>}
        {message.tool_name && (
          <div className="mt-1.5 text-xs opacity-60 flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Tool: {message.tool_name}
          </div>
        )}
      </div>

      {isUser && (
        <div
          className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </div>
      )}

      <time className="text-xs opacity-40 self-end mt-1 px-1" dateTime={message.created_at}>
        {formatTime(new Date(message.created_at))}
      </time>
    </div>
  );
}