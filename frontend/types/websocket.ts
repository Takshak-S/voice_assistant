export type AssistantState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'executing_tool'
  | 'responding'
  | 'speaking'
  | 'interrupted'
  | 'error';

export type WSMessageType =
  // Client -> Server
  | 'user_message'
  | 'start_listening'
  | 'stop_speaking'
  | 'cancel_request'
  | 'new_conversation'
  | 'ping'
  // Server -> Client
  | 'state_change'
  | 'transcription_started'
  | 'transcription_completed'
  | 'thinking_started'
  | 'tool_execution_started'
  | 'tool_execution_completed'
  | 'response_chunk'
  | 'response_complete'
  | 'request_cancelled'
  | 'error'
  | 'pong'
  | 'conversation_created';

export interface WSClientMessage {
  type: WSMessageType;
  request_id: string;
  conversation_id?: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WSServerMessage {
  type: WSMessageType;
  request_id: string;
  conversation_id?: number;
  timestamp: string;
  data: Record<string, unknown>;
}

// Client message types
export interface UserMessage extends WSClientMessage {
  type: 'user_message';
  data: { content: string };
}

export interface StartListeningMessage extends WSClientMessage {
  type: 'start_listening';
}

export interface StopSpeakingMessage extends WSClientMessage {
  type: 'stop_speaking';
}

export interface CancelRequestMessage extends WSClientMessage {
  type: 'cancel_request';
}

export interface NewConversationMessage extends WSClientMessage {
  type: 'new_conversation';
}

export interface PingMessage extends WSClientMessage {
  type: 'ping';
}

// Server message types
export interface StateChangeMessage extends WSServerMessage {
  type: 'state_change';
  data: { state: AssistantState };
}

export interface TranscriptionStartedMessage extends WSServerMessage {
  type: 'transcription_started';
}

export interface TranscriptionCompletedMessage extends WSServerMessage {
  type: 'transcription_completed';
  data: { text: string; is_final: boolean };
}

export interface ThinkingStartedMessage extends WSServerMessage {
  type: 'thinking_started';
}

export interface ToolExecutionStartedMessage extends WSServerMessage {
  type: 'tool_execution_started';
  data: { name: string; args: Record<string, unknown> };
}

export interface ToolExecutionCompletedMessage extends WSServerMessage {
  type: 'tool_execution_completed';
  data: { name: string; result: unknown; error: string | null };
}

export interface ResponseChunkMessage extends WSServerMessage {
  type: 'response_chunk';
  data: { content: string };
}

export interface ResponseCompleteMessage extends WSServerMessage {
  type: 'response_complete';
}

export interface RequestCancelledMessage extends WSServerMessage {
  type: 'request_cancelled';
  data: { request_id: string };
}

export interface ErrorMessage extends WSServerMessage {
  type: 'error';
  data: { message: string; code: string };
}

export interface PongMessage extends WSServerMessage {
  type: 'pong';
}

export interface ConversationCreatedMessage extends WSServerMessage {
  type: 'conversation_created';
  data: { conversation_id: number };
}

export type AnyClientMessage =
  | UserMessage
  | StartListeningMessage
  | StopSpeakingMessage
  | CancelRequestMessage
  | NewConversationMessage
  | PingMessage;

export type AnyServerMessage =
  | StateChangeMessage
  | TranscriptionStartedMessage
  | TranscriptionCompletedMessage
  | ThinkingStartedMessage
  | ToolExecutionStartedMessage
  | ToolExecutionCompletedMessage
  | ResponseChunkMessage
  | ResponseCompleteMessage
  | RequestCancelledMessage
  | ErrorMessage
  | PongMessage
  | ConversationCreatedMessage;