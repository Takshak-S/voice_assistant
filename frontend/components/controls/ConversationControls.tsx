'use client';

import { Button } from '@/components/ui/Button';
import { Plus, Trash2, RotateCcw } from 'lucide-react';

interface ConversationControlsProps {
  onNewConversation: () => void;
  onClearConversation: () => void;
  onRetry?: () => void;
  hasMessages: boolean;
  loading?: boolean;
}

export function ConversationControls({
  onNewConversation,
  onClearConversation,
  onRetry,
  hasMessages,
  loading,
}: ConversationControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearConversation}
          loading={loading}
          aria-label="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear</span>
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