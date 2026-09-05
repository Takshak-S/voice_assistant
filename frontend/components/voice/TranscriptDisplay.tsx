'use client';

import { cn } from '@/lib/utils';

interface TranscriptDisplayProps {
  transcript: string;
  isFinal: boolean;
  className?: string;
}

export function TranscriptDisplay({ transcript, isFinal, className }: TranscriptDisplayProps) {
  if (!transcript) return null;

  return (
    <div
      className={cn(
        'fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40 animate-slide-up',
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          'rounded-2xl px-6 py-4 shadow-xl backdrop-blur-sm border',
          isFinal
            ? 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700'
            : 'bg-primary-50/90 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {isFinal ? 'Final Transcript' : 'Listening...'}
          </span>
          {!isFinal && (
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          )}
        </div>
        <p className="text-base text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
          {transcript}
        </p>
      </div>
    </div>
  );
}