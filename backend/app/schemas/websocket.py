from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AssistantState(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    TRANSCRIBING = "transcribing"
    THINKING = "thinking"
    EXECUTING_TOOL = "executing_tool"
    RESPONDING = "responding"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"
    ERROR = "error"


class WSMessageType(str, Enum):
    # Client -> Server
    USER_MESSAGE = "user_message"
    START_LISTENING = "start_listening"
    STOP_SPEAKING = "stop_speaking"
    CANCEL_REQUEST = "cancel_request"
    NEW_CONVERSATION = "new_conversation"
    PING = "ping"

    # Server -> Client
    STATE_CHANGE = "state_change"
    TRANSCRIPTION_STARTED = "transcription_started"
    TRANSCRIPTION_COMPLETED = "transcription_completed"
    THINKING_STARTED = "thinking_started"
    TOOL_EXECUTION_STARTED = "tool_execution_started"
    TOOL_EXECUTION_COMPLETED = "tool_execution_completed"
    RESPONSE_CHUNK = "response_chunk"
    RESPONSE_COMPLETE = "response_complete"
    REQUEST_CANCELLED = "request_cancelled"
    ERROR = "error"
    PONG = "pong"
    CONVERSATION_CREATED = "conversation_created"


class WSClientMessage(BaseModel):
    type: WSMessageType
    request_id: str = Field(default_factory=lambda: str(UUID(int=0)))  # Will be overridden
    conversation_id: int | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: dict = Field(default_factory=dict)


class WSServerMessage(BaseModel):
    type: WSMessageType
    request_id: str
    conversation_id: int | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: dict = Field(default_factory=dict)


# Client message types
class UserMessage(WSClientMessage):
    type: WSMessageType = WSMessageType.USER_MESSAGE
    data: dict = Field(default_factory=lambda: {"content": ""})


class StartListeningMessage(WSClientMessage):
    type: WSMessageType = WSMessageType.START_LISTENING


class StopSpeakingMessage(WSClientMessage):
    type: WSMessageType = WSMessageType.STOP_SPEAKING


class CancelRequestMessage(WSClientMessage):
    type: WSMessageType = WSMessageType.CANCEL_REQUEST


class NewConversationMessage(WSClientMessage):
    type: WSMessageType = WSMessageType.NEW_CONVERSATION


class PingMessage(WSClientMessage):
    type: WSMessageType = WSMessageType.PING


# Server message types
class StateChangeMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.STATE_CHANGE
    data: dict = Field(default_factory=lambda: {"state": "idle"})


class TranscriptionStartedMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.TRANSCRIPTION_STARTED


class TranscriptionCompletedMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.TRANSCRIPTION_COMPLETED
    data: dict = Field(default_factory=lambda: {"text": "", "is_final": True})


class ThinkingStartedMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.THINKING_STARTED


class ToolExecutionStartedMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.TOOL_EXECUTION_STARTED
    data: dict = Field(default_factory=lambda: {"name": "", "args": {}})


class ToolExecutionCompletedMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.TOOL_EXECUTION_COMPLETED
    data: dict = Field(default_factory=lambda: {"name": "", "result": None, "error": None})


class ResponseChunkMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.RESPONSE_CHUNK
    data: dict = Field(default_factory=lambda: {"content": ""})


class ResponseCompleteMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.RESPONSE_COMPLETE


class RequestCancelledMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.REQUEST_CANCELLED
    data: dict = Field(default_factory=lambda: {"request_id": ""})


class ErrorMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.ERROR
    data: dict = Field(default_factory=lambda: {"message": "", "code": ""})


class PongMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.PONG


class ConversationCreatedMessage(WSServerMessage):
    type: WSMessageType = WSMessageType.CONVERSATION_CREATED
    data: dict = Field(default_factory=lambda: {"conversation_id": 0})


# Union types for validation
AnyClientMessage = (
    UserMessage
    | NewConversationMessage
    | CancelRequestMessage
    | PingMessage
)

AnyServerMessage = (
    StateChangeMessage
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
    | ConversationCreatedMessage
)