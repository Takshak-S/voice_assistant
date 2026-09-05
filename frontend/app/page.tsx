'use client';

import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { ConversationArea } from '@/components/conversation/ConversationArea';
import { VoiceControl } from '@/components/voice/VoiceControl';
import { ConversationControls } from '@/components/controls/ConversationControls';
import { MuteToggle } from '@/components/controls/MuteToggle';
import { ThemeToggle } from '@/components/controls/ThemeToggle';
import { StateIndicator } from '@/components/voice/StateIndicator';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Mic, Send, X, Settings, Bot, Wifi, WifiOff } from 'lucide-react';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { cn } from '@/lib/utils';

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
    handleVoiceStart,
    handleVoiceStop,
    handleSendText,
    handleNewConversation,
    handleStopSpeaking,
    handleClearError,
    toggleMute,
    setVolume,
  } = useVoiceAssistant();

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const hasMessages = messages.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleSendText(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Voice Assistant</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Real-time AI conversation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <span className="flex-shrink-0">!</span>
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
              placeholder="Type a message..."
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

        <div className="mx-4 mb-4 flex items-center justify-between">
          <ConversationControls
            onNewConversation={handleNewConversation}
            onClearConversation={handleNewConversation}
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
    </div>
  );
}