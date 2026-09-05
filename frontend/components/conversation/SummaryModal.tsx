'use client';

import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  title: string;
  messageCount: number;
  isLoading: boolean;
}

export function SummaryModal({
  isOpen,
  onClose,
  summary,
  title,
  messageCount,
  isLoading,
}: SummaryModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold">
            <Sparkles className="w-5 h-5" />
            <h3>Conversation Summary</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close summary modal">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <p className="text-sm text-slate-500">Generating conversation summary...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-400">
              {title} • {messageCount} messages analyzed
            </div>
            <div className="max-h-72 overflow-y-auto pr-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              {summary || 'No summary available.'}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" size="sm" onClick={handleCopy} disabled={isLoading || !summary}>
            {copied ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
