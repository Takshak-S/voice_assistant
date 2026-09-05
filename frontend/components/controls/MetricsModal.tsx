'use client';

import React from 'react';
import { BarChart3, X, Cpu, Clock, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface MetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageCount: number;
  toolsExecutedCount: number;
  lastLatencyMs: number | null;
  modelName: string;
}

export function MetricsModal({
  isOpen,
  onClose,
  messageCount,
  toolsExecutedCount,
  lastLatencyMs,
  modelName,
}: MetricsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold">
            <BarChart3 className="w-5 h-5" />
            <h3>Session Analytics & Metrics</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close metrics modal">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Last Latency</span>
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {lastLatencyMs !== null ? `${lastLatencyMs} ms` : '—'}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>Messages</span>
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {messageCount}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <span>Tools Executed</span>
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {toolsExecutedCount}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Zap className="w-3.5 h-3.5 text-purple-500" />
              <span>Active Model</span>
            </div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-1" title={modelName}>
              {modelName}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
