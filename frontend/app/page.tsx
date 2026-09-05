'use client';

import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { ConversationArea } from '@/components/conversation/ConversationArea';
import { VoiceControl } from '@/components/voice/VoiceControl';
import { ConversationControls } from '@/components/controls/ConversationControls';
import { MuteToggle } from '@/components/controls/MuteToggle';
import { ThemeToggle } from '@/components/controls/ThemeToggle';
import { LanguageSelector } from '@/components/controls/LanguageSelector';
import { SummaryModal } from '@/components/conversation/SummaryModal';
import { MetricsModal } from '@/components/controls/MetricsModal';
import { StateIndicator } from '@/components/voice/StateIndicator';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Send, X, Bot, Wifi, WifiOff } from 'lucide-react';
import { useState, useRef, FormEvent } from 'react';
import { api } from '@/lib/api';
import type { Message } from '@/types/conversation';

export default function HomePage() {
  const {
    conversationId,
    messages,
    state,
    transcript,
    isFinalTranscript,
    isRecording,
    audioLevel,
    isConnected,
    connectionError,
    isLoading,
    error,
    isSpeaking,
    isMuted,
    volume,
    language,
    setLanguage,
    metrics,
    handleVoiceStart,
    handleVoiceStop,
    handleSendText,
    handleNewConversation,
    handleStopSpeaking,
    handleClearError,
    importMessages,
    toggleMute,
    setVolume,
  } = useVoiceAssistant();

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState({ title: '', summary: '', messageCount: 0 });
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  const hasMessages = messages.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleSendText(inputValue.trim());
      setInputValue('');
    }
  };

  const handleSummarize = async () => {
    if (!conversationId) return;
    setIsSummaryOpen(true);
    setIsSummaryLoading(true);
    try {
      const res = await api.summarizeConversation(conversationId);
      setSummaryData({
        title: res.title || 'Conversation Summary',
        summary: res.summary || '',
        messageCount: res.message_count || messages.length,
      });
    } catch (err) {
      setSummaryData({
        title: 'Summary Error',
        summary: 'Failed to generate conversation summary. Please ensure the backend is running.',
        messageCount: messages.length,
      });
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleExportMarkdown = () => {
    if (messages.length === 0) return;
    const header = `# Voice Assistant Conversation Transcript\n*Exported on: ${new Date().toLocaleString()}*\n\n---\n\n`;
    const body = messages
      .map((m) => `### ${m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'Tool'}\n${m.content}\n`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId || 'chat'}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (messages.length === 0) return;
    const data = {
      conversation_id: conversationId,
      exported_at: new Date().toISOString(),
      messages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId || 'chat'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (imported: Message[]) => {
    importMessages(imported);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Voice Assistant</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Real-time AI conversation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Disconnected</span>
                </>
              )}
            </div>

            <StateIndicator state={state} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
        <ConversationArea messages={messages} isStreaming={state === 'thinking' || state === 'responding'} />

        {error && (
          <div className="mx-4 mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center justify-between animate-slide-down">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <span className="flex-shrink-0 font-bold">!</span>
              <span className="text-sm">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearError}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <VoiceControl
          state={state}
          isRecording={isRecording}
          audioLevel={audioLevel}
          transcript={transcript}
          isFinalTranscript={isFinalTranscript}
          onStart={handleVoiceStart}
          onStop={handleVoiceStop}
          disabled={isLoading || !isConnected}
        />

        <Card className="mx-4 mb-4">
          <form onSubmit={handleSubmit} className="flex gap-2 p-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message or click microphone above..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50"
              disabled={state === 'thinking' || state === 'responding' || state === 'executing_tool' || !isConnected}
              aria-label="Type your message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || state === 'thinking' || state === 'responding' || !isConnected}
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </Card>

        <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <ConversationControls
            onNewConversation={handleNewConversation}
            onClearConversation={handleNewConversation}
            onSummarize={handleSummarize}
            onExportMarkdown={handleExportMarkdown}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onOpenMetrics={() => setIsMetricsOpen(true)}
            hasMessages={hasMessages}
            loading={isLoading}
          />
          <MuteToggle
            isMuted={isMuted}
            volume={volume}
            onToggleMute={toggleMute}
            onVolumeChange={setVolume}
          />
        </div>

        {!isConnected && connectionError && (
          <div className="mx-4 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-center text-sm text-amber-700 dark:text-amber-300">
            Connection lost. Attempting to reconnect...
          </div>
        )}
      </main>

      {/* Summary Modal */}
      <SummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        title={summaryData.title}
        summary={summaryData.summary}
        messageCount={summaryData.messageCount}
        isLoading={isSummaryLoading}
      />

      {/* Metrics Modal */}
      <MetricsModal
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
        messageCount={metrics.messageCount}
        toolsExecutedCount={metrics.toolsExecutedCount}
        lastLatencyMs={metrics.lastLatencyMs}
        modelName={metrics.modelName}
      />
    </div>
  );
}