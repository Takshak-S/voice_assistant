import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  AnyServerMessage,
  WSClientMessage,
  AssistantState,
  WSMessageType,
  UserMessage,
  StartListeningMessage,
  StopSpeakingMessage,
  CancelRequestMessage,
  NewConversationMessage,
  PingMessage,
  StateChangeMessage,
  TranscriptionStartedMessage,
  TranscriptionCompletedMessage,
  ThinkingStartedMessage,
  ToolExecutionStartedMessage,
  ToolExecutionCompletedMessage,
  ResponseChunkMessage,
  ResponseCompleteMessage,
  RequestCancelledMessage,
  ErrorMessage,
  PongMessage,
  ConversationCreatedMessage,
} from '@/types/websocket';

interface UseWebSocketOptions {
  url: string;
  activeRequestIdRef?: React.MutableRefObject<string | null>;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onReconnect?: () => void;
  onMessage?: (message: AnyServerMessage) => void;
  onStateChange?: (state: AssistantState, requestId: string) => void;
  onTranscriptionStarted?: (requestId: string) => void;
  onTranscriptionCompleted?: (text: string, isFinal: boolean, requestId: string) => void;
  onThinkingStarted?: (requestId: string) => void;
  onToolExecutionStarted?: (name: string, args: Record<string, unknown>, requestId: string) => void;
  onToolExecutionCompleted?: (name: string, result: unknown, error: string | null, requestId: string) => void;
  onResponseChunk?: (text: string, requestId: string) => void;
  onResponseComplete?: (requestId: string) => void;
  onRequestCancelled?: (requestId: string) => void;
  onErrorMessage?: (message: string, code: string, requestId: string) => void;
  onConversationCreated?: (conversationId: number, requestId: string) => void;
}

export function useWebSocket({
  url,
  activeRequestIdRef,
  onOpen,
  onClose,
  onError,
  onReconnect,
  onMessage,
  onStateChange,
  onTranscriptionStarted,
  onTranscriptionCompleted,
  onThinkingStarted,
  onToolExecutionStarted,
  onToolExecutionCompleted,
  onResponseChunk,
  onResponseComplete,
  onRequestCancelled,
  onErrorMessage,
  onConversationCreated,
}: UseWebSocketOptions) {
  const optionsRef = useRef({
    onOpen,
    onClose,
    onError,
    onReconnect,
    onMessage,
    onStateChange,
    onTranscriptionStarted,
    onTranscriptionCompleted,
    onThinkingStarted,
    onToolExecutionStarted,
    onToolExecutionCompleted,
    onResponseChunk,
    onResponseComplete,
    onRequestCancelled,
    onErrorMessage,
    onConversationCreated,
  });

  optionsRef.current = {
    onOpen,
    onClose,
    onError,
    onReconnect,
    onMessage,
    onStateChange,
    onTranscriptionStarted,
    onTranscriptionCompleted,
    onThinkingStarted,
    onToolExecutionStarted,
    onToolExecutionCompleted,
    onResponseChunk,
    onResponseComplete,
    onRequestCancelled,
    onErrorMessage,
    onConversationCreated,
  };

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const sendMessage = useCallback((message: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const createClientMessage = useCallback((
    type: WSMessageType,
    data: Record<string, unknown> = {},
    conversationId?: number
  ): WSClientMessage => {
    return {
      type,
      request_id: activeRequestIdRef?.current || crypto.randomUUID(),
      conversation_id: conversationId,
      timestamp: new Date().toISOString(),
      data,
    };
  }, [activeRequestIdRef]);

  const sendUserMessage = useCallback((content: string, conversationId?: number) => {
    sendMessage(createClientMessage('user_message', { content }, conversationId));
  }, [createClientMessage, sendMessage]);

  const sendStartListening = useCallback((conversationId?: number) => {
    sendMessage(createClientMessage('start_listening', {}, conversationId));
  }, [createClientMessage, sendMessage]);

  const sendStopSpeaking = useCallback((conversationId?: number) => {
    sendMessage(createClientMessage('stop_speaking', {}, conversationId));
  }, [createClientMessage, sendMessage]);

  const sendCancelRequest = useCallback((conversationId?: number) => {
    sendMessage(createClientMessage('cancel_request', {}, conversationId));
  }, [createClientMessage, sendMessage]);

  const sendNewConversation = useCallback(() => {
    sendMessage(createClientMessage('new_conversation', {}));
  }, [createClientMessage, sendMessage]);

  const sendPing = useCallback(() => {
    sendMessage(createClientMessage('ping', {}));
  }, [createClientMessage, sendMessage]);

  const connect = useCallback(() => {
    if (!url) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onclose = (event) => {
        const wasConnected = isConnected;
        setIsConnected(false);
        optionsRef.current.onClose?.();

        // Do not reconnect if closed cleanly or if no url is set
        if (event.code === 1000 || !url) return;

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (wasConnected) {
          // Max retries exceeded, notify parent
          setConnectionError('Connection lost. Please refresh the page.');
        }
      };

      ws.onopen = () => {
        const isReconnect = reconnectAttempts.current > 0;
        setIsConnected(true);
        setConnectionError(null);
        if (isReconnect) {
          reconnectAttempts.current = 0;
          optionsRef.current.onReconnect?.();
        } else {
          reconnectAttempts.current = 0;
          optionsRef.current.onOpen?.();
        }
      };

      ws.onerror = (error) => {
        setConnectionError('Connection error');
        optionsRef.current.onError?.(error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as AnyServerMessage;
          optionsRef.current.onMessage?.(message);

          // Only filter response streaming for stale requests
          if (['response_chunk', 'response_complete'].includes(message.type)) {
            if (activeRequestIdRef && activeRequestIdRef.current && message.request_id && message.request_id !== activeRequestIdRef.current) {
              return;
            }
          }

          switch (message.type) {
            case 'state_change':
              optionsRef.current.onStateChange?.((message as StateChangeMessage).data.state, message.request_id);
              break;
            case 'transcription_started':
              optionsRef.current.onTranscriptionStarted?.(message.request_id);
              break;
            case 'transcription_completed':
              optionsRef.current.onTranscriptionCompleted?.(
                (message as TranscriptionCompletedMessage).data.text,
                (message as TranscriptionCompletedMessage).data.is_final,
                message.request_id
              );
              break;
            case 'thinking_started':
              optionsRef.current.onThinkingStarted?.(message.request_id);
              break;
            case 'tool_execution_started':
              optionsRef.current.onToolExecutionStarted?.(
                (message as ToolExecutionStartedMessage).data.name,
                (message as ToolExecutionStartedMessage).data.args,
                message.request_id
              );
              break;
            case 'tool_execution_completed':
              optionsRef.current.onToolExecutionCompleted?.(
                (message as ToolExecutionCompletedMessage).data.name,
                (message as ToolExecutionCompletedMessage).data.result,
                (message as ToolExecutionCompletedMessage).data.error,
                message.request_id
              );
              break;
            case 'response_chunk':
              optionsRef.current.onResponseChunk?.((message as ResponseChunkMessage).data.content, message.request_id);
              break;
            case 'response_complete':
              optionsRef.current.onResponseComplete?.(message.request_id);
              break;
            case 'request_cancelled':
              optionsRef.current.onRequestCancelled?.((message as RequestCancelledMessage).data.request_id);
              break;
            case 'error':
              optionsRef.current.onErrorMessage?.(
                (message as ErrorMessage).data.message,
                (message as ErrorMessage).data.code,
                message.request_id
              );
              break;
            case 'conversation_created':
              optionsRef.current.onConversationCreated?.(
                (message as ConversationCreatedMessage).data.conversation_id,
                message.request_id
              );
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    } catch (e) {
      setConnectionError('Failed to create WebSocket');
    }
  }, [url, activeRequestIdRef]);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      setConnectionError(null);
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [connect, url]);

  return {
    isConnected,
    connectionError,
    sendMessage,
    sendUserMessage,
    sendStartListening,
    sendStopSpeaking,
    sendCancelRequest,
    sendNewConversation,
    sendPing,
    reconnect: connect,
  };
}