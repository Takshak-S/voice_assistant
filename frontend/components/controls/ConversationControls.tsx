'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, RotateCcw, Sparkles, Download, Upload, BarChart2 } from 'lucide-react';
import type { Message } from '@/types/conversation';

interface ConversationControlsProps {
  onNewConversation: () => void;
  onClearConversation: () => void;
  onRetry?: () => void;
  onSummarize?: () => void;
  onOpenMetrics?: () => void;
  onExportMarkdown?: () => void;
  onExportJson?: () => void;
  onImportJson?: (messages: Message[]) => void;
  hasMessages: boolean;
  loading?: boolean;
}

export function ConversationControls({
  onNewConversation,
  onClearConversation,
  onRetry,
  onSummarize,
  onOpenMetrics,
  onExportMarkdown,
  onExportJson,
  onImportJson,
  hasMessages,
  loading,
}: ConversationControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportJson?.(parsed);
        } else if (parsed.messages && Array.isArray(parsed.messages)) {
          onImportJson?.(parsed.messages);
        }
      } catch (err) {
        alert('Invalid JSON conversation file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onNewConversation}
        loading={loading}
        aria-label="Start new conversation"
      >
        <Plus className="w-4 h-4" />
        <span>New Chat</span>
      </Button>

      {hasMessages && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearConversation}
            loading={loading}
            aria-label="Clear conversation"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Clear</span>
          </Button>

          {onSummarize && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSummarize}
              loading={loading}
              aria-label="Summarize conversation"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Summarize</span>
            </Button>
          )}

          {onExportMarkdown && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportMarkdown}
              aria-label="Export Markdown transcript"
              title="Export as Markdown"
            >
              <Download className="w-4 h-4" />
              <span>Export .md</span>
            </Button>
          )}

          {onExportJson && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportJson}
              aria-label="Export JSON"
              title="Export as JSON"
            >
              <Download className="w-4 h-4" />
              <span>JSON</span>
            </Button>
          )}
        </>
      )}

      {onImportJson && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
            aria-hidden="true"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import conversation"
            title="Import JSON conversation"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </Button>
        </>
      )}

      {onOpenMetrics && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenMetrics}
          aria-label="Session metrics"
          title="View Session Metrics"
        >
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <span>Stats</span>
        </Button>
      )}

      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          loading={loading}
          aria-label="Retry last action"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
}