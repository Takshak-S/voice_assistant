import { useState, useCallback, useEffect, useRef } from 'react';
import { api, getWebSocketUrl } from '@/lib/api';
import { useWebSocket } from './useWebSocket';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';
import type { AssistantState } from '@/types/websocket';
import type { Conversation, Message } from '@/types/conversation';

interface UseVoiceAssistantOptions {
  initialConversationId?: number;
}

export function useVoiceAssistant({ initialConversationId }: UseVoiceAssistantOptions = {}) {
  const [conversationId, setConversationId] = useState<number | null>(initialConversationId || null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<AssistantState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<{ name: string; args: Record<string, unknown> } | null>(null);
  const [isSttSupported, setIsSttSupported] = useState(false);

  const activeRequestIdRef = useRef<string | null>(null);
  const responseAccumulator = useRef('');
  const isSpeakingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const hasSentVoiceRef = useRef(false);

  const speech = useSpeechSynthesis();

  const createNewRequest = useCallback(() => {
    activeRequestIdRef.current = crypto.randomUUID();
    return activeRequestIdRef.current;
  }, []);

  const handleInterruption = useCallback(() => {
    speech.stop();
    isSpeakingRef.current = false;

    if (activeRequestIdRef.current) {
      sendCancelRequest();
      activeRequestIdRef.current = null;
    }

    setToolStatus(null);
    responseAccumulator.current = '';
  }, [speech]);

  const {
    isConnected,
    connectionError,
    sendUserMessage: wsSendUserMessage,
    sendStartListening,
    sendStopSpeaking,
    sendCancelRequest,
    sendNewConversation,
    sendPing,
    reconnect,
  } = useWebSocket({
    url: conversationId ? getWebSocketUrl(conversationId) : '',
    activeRequestIdRef,
    onOpen: () => setError(null),
    onClose: () => {
      setState('idle');
      isSpeakingRef.current = false;
    },
    onError: () => setError('Connection lost. Reconnecting...'),
    onStateChange: (newState) => {
      setState(newState);
    },
    onTranscriptionStarted: () => {
      setState('transcribing');
    },
    onTranscriptionCompleted: (text, isFinal) => {
      if (isFinal) {
        setTranscript(text);
        setInterimTranscript('');
      } else {
        setInterimTranscript(text);
      }
    },
    onThinkingStarted: () => {
      setState('thinking');
      setToolStatus(null);
    },
    onToolExecutionStarted: (name, args) => {
      setState('executing_tool');
      setToolStatus({ name, args });
    },
    onToolExecutionCompleted: () => {
      setToolStatus(null);
      setState('thinking');
    },
    onResponseChunk: (text, requestId) => {
      if (!text) return;
      if (!activeRequestIdRef.current || activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = requestId;
        responseAccumulator.current += text;
        setState('responding');
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: responseAccumulator.current + '▌', created_at: new Date().toISOString() },
            ];
          }
          return [
            ...prev,
            { id: Date.now(), role: 'assistant', content: responseAccumulator.current + '▌', created_at: new Date().toISOString() },
          ];
        });
      }
    },
    onResponseComplete: (requestId) => {
      if (!activeRequestIdRef.current || activeRequestIdRef.current === requestId) {
        const fullResponse = responseAccumulator.current.trim();
        responseAccumulator.current = '';

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            if (!fullResponse) {
              return prev.slice(0, -1);
            }
            return [...prev.slice(0, -1), { ...last, content: fullResponse }];
          }
          if (fullResponse) {
            return [
              ...prev,
              { id: Date.now(), role: 'assistant', content: fullResponse, created_at: new Date().toISOString() },
            ];
          }
          return prev;
        });

        if (fullResponse) {
          speech.speak(
            fullResponse,
            () => {
              isSpeakingRef.current = true;
              setState('speaking');
            },
            () => {
              isSpeakingRef.current = false;
              setState('idle');
            }
          );
        } else {
          setState('idle');
        }
      }
    },
    onRequestCancelled: (requestId) => {
      if (activeRequestIdRef.current === requestId) {
        handleInterruption();
      }
    },
    onErrorMessage: (message) => {
      setError(message);
      setState('error');
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && (!last.content || last.content === '▌')) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setTimeout(() => setState('idle'), 3000);
    },
    onConversationCreated: (newConversationId) => {
      setConversationId(newConversationId);
      setConversation(null);
      setMessages([]);
      setTranscript('');
      setInterimTranscript('');
      responseAccumulator.current = '';
    },
  });

  const sendUserMessage = useCallback(
    (content: string) => {
      if (!conversationId || !content.trim()) return;

      stopListening();
      speech.stop();
      isSpeakingRef.current = false;

      const requestId = createNewRequest();

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: 'user', content: content.trim(), created_at: new Date().toISOString() },
      ]);

      setState('thinking');
      responseAccumulator.current = '';
      wsSendUserMessage(content.trim());
    },
    [conversationId, createNewRequest, speech, wsSendUserMessage]
  );

  const { isListening, error: sttError, startListening, stopListening, abortListening, isSupported: sttSupported } = useSpeechRecognition({
    continuous: false,
    interimResults: true,
    onResult: (text, isFinal) => {
      lastTranscriptRef.current = text;
      if (isFinal) {
        setTranscript(text);
        setInterimTranscript('');
        if (text.trim() && !hasSentVoiceRef.current && conversationId) {
          hasSentVoiceRef.current = true;
          sendUserMessage(text.trim());
        }
      } else {
        setInterimTranscript(text);
      }
    },
    onError: (err) => {
      setError(err.message);
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    },
    onStart: () => {
      setState('listening');
    },
    onEnd: () => {
      if (lastTranscriptRef.current.trim() && !hasSentVoiceRef.current && conversationId) {
        hasSentVoiceRef.current = true;
        sendUserMessage(lastTranscriptRef.current.trim());
      } else if (!hasSentVoiceRef.current) {
        setState((curr) => (curr === 'listening' ? 'idle' : curr));
      }
    },
  });

  const handleVoiceStart = useCallback(() => {
    speech.stop();
    isSpeakingRef.current = false;
    hasSentVoiceRef.current = false;
    lastTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    sendStartListening();
    startListening();
    setState('listening');
  }, [speech, sendStartListening, startListening]);

  const handleVoiceStop = useCallback(() => {
    stopListening();
    if (lastTranscriptRef.current.trim() && !hasSentVoiceRef.current && conversationId) {
      hasSentVoiceRef.current = true;
      sendUserMessage(lastTranscriptRef.current.trim());
    } else if (!hasSentVoiceRef.current) {
      setState('idle');
    }
  }, [stopListening, conversationId, sendUserMessage]);

  const handleSendText = useCallback(
    (text: string) => {
      if (!text.trim() || !conversationId) return;
      sendUserMessage(text.trim());
    },
    [conversationId, sendUserMessage]
  );

  const handleNewConversation = useCallback(async () => {
    try {
      setIsLoading(true);
      const newConv = await api.createConversation();
      setConversationId(newConv.id);
      setConversation(newConv);
      setMessages([]);
      setTranscript('');
      setInterimTranscript('');
      responseAccumulator.current = '';
    } catch (err) {
      setError('Failed to create conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStopSpeaking = useCallback(() => {
    handleInterruption();
    setState('idle');
  }, [handleInterruption]);

  const handleClearError = useCallback(() => {
    setError(null);
    setState('idle');
  }, []);

  // Start ping interval to keep connection alive
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      sendPing();
    }, 30000);
    return () => clearInterval(interval);
  }, [isConnected, sendPing]);

  // Initialize conversation on mount if none provided
  const initRef = useRef(false);
  useEffect(() => {
    if (!conversationId && !initRef.current) {
      initRef.current = true;
      handleNewConversation();
    }
  }, [conversationId, handleNewConversation]);

  // Update STT support state
  useEffect(() => {
    setIsSttSupported(sttSupported);
  }, [sttSupported]);

  return {
    conversationId,
    conversation,
    messages,
    state,
    transcript: transcript || interimTranscript,
    isFinalTranscript: !!transcript,
    isRecording: isListening || state === 'listening',
    audioLevel: 0,
    isConnected,
    connectionError,
    isLoading,
    error,
    isSpeaking: speech.isPlaying || isSpeakingRef.current,
    isMuted: speech.isMuted,
    volume: speech.volume,
    toolStatus,
    isSttSupported,
    handleVoiceStart,
    handleVoiceStop,
    handleSendText,
    handleNewConversation,
    handleStopSpeaking,
    handleClearError,
    toggleMute: speech.toggleMute,
    setVolume: speech.setVolume,
  };
}