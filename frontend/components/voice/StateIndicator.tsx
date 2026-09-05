'use client';

import { AssistantState } from '@/types/websocket';
import { cn } from '@/lib/utils';
import {
  Mic,
  Loader2,
  Brain,
  Cpu,
  MessageSquare,
  Volume2,
  AlertCircle,
} from 'lucide-react';

const stateInfo: Record<AssistantState, { label: string; icon: React.ReactNode; color: string }> = {
  idle: { label: 'Ready', icon: <Mic className="w-4 h-4" />, color: 'text-slate-500' },
  listening: { label: 'Listening', icon: <Mic className="w-4 h-4 animate-pulse" />, color: 'text-red-500' },
  transcribing: { label: 'Transcribing', icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-amber-500' },
  thinking: { label: 'Thinking', icon: <Brain className="w-4 h-4 animate-pulse" />, color: 'text-blue-500' },
  executing_tool: { label: 'Using tool', icon: <Cpu className="w-4 h-4 animate-spin" />, color: 'text-purple-500' },
  responding: { label: 'Responding', icon: <MessageSquare className="w-4 h-4 animate-pulse" />, color: 'text-indigo-500' },
  speaking: { label: 'Speaking', icon: <Volume2 className="w-4 h-4 animate-pulse" />, color: 'text-green-500' },
  interrupted: { label: 'Interrupted', icon: <AlertCircle className="w-4 h-4 animate-pulse" />, color: 'text-orange-500' },
  error: { label: 'Error', icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-500' },
};

interface StateIndicatorProps {
  state: AssistantState;
  className?: string;
}

export function StateIndicator({ state, className }: StateIndicatorProps) {
  const info = stateInfo[state];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        className
      )}
    >
      <span className={cn(info.color)}>{info.icon}</span>
      <span className={cn('capitalize', info.color)}>{info.label}</span>
    </div>
  );
}

export function StateBadge({ state }: { state: AssistantState }) {
  const info = stateInfo[state];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        `${info.color.replace('text-', 'bg-')}/10 ${info.color} border ${info.color.replace('text-', 'border-')}/20`
      )}
    >
      {info.icon}
      <span>{info.label}</span>
    </span>
  );
}