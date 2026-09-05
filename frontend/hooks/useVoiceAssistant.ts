import { useState, useCallback, useEffect, useRef } from 'react';
import { api, getWebSocketUrl } from '@/lib/api';
import { useWebSocket } from './useWebSocket';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';
import { useAudioRecorder } from './useAudioRecorder';
import type { AssistantState } from '@/types/websocket';
import type { Conversation, Message } from '@/types/conversation';

interface UseVoiceAssistantOptions {
  initialConversationId?: number;
  initialLanguage?: string;
}

export function useVoiceAssistant({
  initialConversationId,
  initialLanguage = 'en-US',
}: UseVoiceAssistantOptions = {}) {
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
  const [language, setLanguage] = useState<string>(initialLanguage);

  // Metrics
  const [toolsExecutedCount, setToolsExecutedCount] = useState(0);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const sendTimeRef = useRef<number | null>(null);

  const activeRequestIdRef = useRef<string | null>(null);
  const responseAccumulator = useRef('');
  const isSpeakingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const hasSentVoiceRef = useRef(false);
  const conversationIdRef = useRef<number | null>(conversationId);
  conversationIdRef.current = conversationId;
  const languageRef = useRef<string>(language);
  languageRef.current = language;
  const isTranscribingRef = useRef(false);

  const speech = useSpeechSynthesis({ lang: language });

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
      setToolsExecutedCount((prev) => prev + 1);
    },
    onToolExecutionCompleted: () => {
      setToolStatus(null);
      setState('thinking');
    },
    onResponseChunk: (text, requestId) => {
      if (!text) return;
      if (sendTimeRef.current) {
        setLastLatencyMs(Date.now() - sendTimeRef.current);
        sendTimeRef.current = null;
      }

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
            },
            language
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

  const sendUserMessageRef = useRef<(content: string) => void>(() => {});

  const audioRecorder = useAudioRecorder({
    onStop: async (blob: Blob) => {
      // If Web Speech API already delivered final text and sent message, skip
      if (hasSentVoiceRef.current) return;

      const currentConvId = conversationIdRef.current;
      if (blob.size > 0 && currentConvId) {
        try {
          isTranscribingRef.current = true;
          setState('transcribing');
          setInterimTranscript('Transcribing with Whisper...');

          const text = await api.transcribeAudio(blob, languageRef.current);
          if (text.trim() && !hasSentVoiceRef.current) {
            hasSentVoiceRef.current = true;
            setTranscript(text.trim());
            setInterimTranscript('');
            sendUserMessageRef.current(text.trim());
            return;
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Transcription failed';
          console.warn('Whisper fallback error:', errMsg);
          setError(errMsg);
          setState('error');
          setTimeout(() => setState('idle'), 3000);
          return;
        } finally {
          isTranscribingRef.current = false;
        }
      }

      if (!hasSentVoiceRef.current) {
        setState('idle');
      }
    },
    onError: (err) => {
      console.warn('Audio recorder warning:', err);
    },
  });

  const sendUserMessage = useCallback(
    (content: string) => {
      if (!conversationId || !content.trim()) return;

      stopListening();
      audioRecorder.stopRecording();
      speech.stop();
      isSpeakingRef.current = false;

      const requestId = createNewRequest();
      sendTimeRef.current = Date.now();

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: 'user', content: content.trim(), created_at: new Date().toISOString() },
      ]);

      setState('thinking');
      responseAccumulator.current = '';
      wsSendUserMessage(content.trim());
    },
    [conversationId, createNewRequest, speech, wsSendUserMessage, audioRecorder]
  );

  sendUserMessageRef.current = sendUserMessage;

  const { isListening, error: sttError, startListening, stopListening, abortListening, isSupported: sttSupported } = useSpeechRecognition({
    lang: language,
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
      // If Chrome SpeechRecognition failed due to network / Google cloud unreachable,
      // ignore and let audioRecorder transcribe via Groq Whisper when recording stops!
      if (err.message.toLowerCase().includes('network')) {
        console.warn('Browser SpeechRecognition network error. Falling back to Groq Whisper.');
        setInterimTranscript('Switching to Whisper transcription...');
        return;
      }
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
      } else if (!hasSentVoiceRef.current && !isTranscribingRef.current) {
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

    // Start microphone recording for Groq Whisper fallback & live visualizer audioLevel
    audioRecorder.startRecording();

    // Also attempt Web Speech API if supported
    if (sttSupported) {
      try {
        startListening();
      } catch (e) {
        console.warn('SpeechRecognition failed to start:', e);
      }
    }
    setState('listening');
  }, [speech, sendStartListening, audioRecorder, sttSupported, startListening]);

  const handleVoiceStop = useCallback(() => {
    stopListening();
    audioRecorder.stopRecording();

    // If Web Speech already got a transcript, send immediately
    if (lastTranscriptRef.current.trim() && !hasSentVoiceRef.current && conversationId) {
      hasSentVoiceRef.current = true;
      sendUserMessage(lastTranscriptRef.current.trim());
    } else if (!hasSentVoiceRef.current) {
      // Otherwise audioRecorder.onStop will transcribe with Whisper
      setState('transcribing');
    }
  }, [stopListening, audioRecorder, conversationId, sendUserMessage]);

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

  const importMessages = useCallback((imported: Message[]) => {
    setMessages(imported);
  }, []);

  const handleStopSpeaking = useCallback(() => {
    handleInterruption();
    audioRecorder.cancelRecording();
    stopListening();
    setState('idle');
  }, [handleInterruption, audioRecorder, stopListening]);

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

  // STT is supported either via Web Speech API or Groq Whisper backend
  useEffect(() => {
    setIsSttSupported(true);
  }, []);

  return {
    conversationId,
    conversation,
    messages,
    state,
    transcript: transcript || interimTranscript,
    isFinalTranscript: !!transcript,
    isRecording: audioRecorder.isRecording || isListening || state === 'listening',
    audioLevel: audioRecorder.audioLevel,
    isConnected,
    connectionError,
    isLoading,
    error,
    isSpeaking: speech.isPlaying || isSpeakingRef.current,
    isMuted: speech.isMuted,
    volume: speech.volume,
    toolStatus,
    isSttSupported: true,
    language,
    setLanguage,
    metrics: {
      messageCount: messages.length,
      toolsExecutedCount,
      lastLatencyMs,
      modelName: 'qwen/qwen3.8-27b',
    },
    handleVoiceStart,
    handleVoiceStop,
    handleSendText,
    handleNewConversation,
    handleStopSpeaking,
    handleClearError,
    importMessages,
    toggleMute: speech.toggleMute,
    setVolume: speech.setVolume,
  };
}