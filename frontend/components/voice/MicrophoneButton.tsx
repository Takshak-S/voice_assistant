'use client';

import { cn } from '@/lib/utils';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { AssistantState } from '@/types/websocket';

interface MicrophoneButtonProps {
  state: AssistantState;
  isRecording: boolean;
  audioLevel: number;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

const stateConfig: Record<AssistantState, { label: string; icon: React.ReactNode; pulse: boolean }> = {
  idle: { label: 'Start listening', icon: <Mic className="w-8 h-8" />, pulse: false },
  listening: { label: 'Listening...', icon: <Mic className="w-8 h-8 text-red-500" />, pulse: true },
  transcribing: { label: 'Transcribing...', icon: <Loader2 className="w-8 h-8 animate-spin" />, pulse: false },
  thinking: { label: 'Thinking...', icon: <Loader2 className="w-8 h-8 animate-spin" />, pulse: false },
  executing_tool: { label: 'Using tool...', icon: <Loader2 className="w-8 h-8 animate-spin" />, pulse: false },
  responding: { label: 'Generating...', icon: <Loader2 className="w-8 h-8 animate-spin" />, pulse: false },
  speaking: { label: 'Speaking...', icon: <Mic className="w-8 h-8 text-green-500" />, pulse: true },
  interrupted: { label: 'Interrupted - Tap to restart', icon: <MicOff className="w-8 h-8 text-orange-500" />, pulse: false },
  error: { label: 'Error - Tap to retry', icon: <MicOff className="w-8 h-8 text-red-500" />, pulse: false },
};

export function MicrophoneButton({
  state,
  isRecording,
  audioLevel,
  onStart,
  onStop,
  disabled,
}: MicrophoneButtonProps) {
  const config = stateConfig[state];
  const isActive = ['listening', 'speaking'].includes(state);

  return (
    <div className="relative flex flex-col items-center gap-4">
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={disabled || ['transcribing', 'thinking', 'executing_tool', 'responding'].includes(state)}
        className={cn(
          'relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isActive
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
            : state === 'error'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
        )}
        aria-label={config.label}
        aria-pressed={isRecording}
      >
        {config.icon}

        {isRecording && (
          <>
            <div
              className={cn(
                'absolute inset-0 rounded-full border-4 border-primary-500/30 animate-ping',
                config.pulse && 'opacity-100'
              )}
            />
            <div
              className="absolute inset-0 rounded-full border-4 border-primary-500/20 animate-ping"
              style={{ animationDelay: '500ms' }}
            />
          </>
        )}

        {state === 'speaking' && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-green-500/30 animate-ping" />
            <div className="absolute inset-0 rounded-full border-4 border-green-500/20 animate-ping" style={{ animationDelay: '500ms' }} />
          </>
        )}
      </button>

      {audioLevelVisualizer({ level: audioLevel, isActive: isRecording })}

      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center px-4">
        {config.label}
      </p>
    </div>
  );
}

function audioLevelVisualizer({ level, isActive }: { level: number; isActive: boolean }) {
  const bars = 5;
  const activeBars = Math.ceil(level * bars);

  if (!isActive) return null;

  return (
    <div className="flex items-end gap-1 h-6" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 rounded-full transition-all duration-75 bg-primary-500',
            i < activeBars ? 'h-full' : 'h-1.5'
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}