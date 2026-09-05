import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.conversation import Message, MessageRole
from app.schemas.conversation import MessageCreate
from app.schemas.websocket import (
    AnyServerMessage,
    AssistantState,
    CancelRequestMessage,
    ConversationCreatedMessage,
    ErrorMessage,
    NewConversationMessage,
    PingMessage,
    PongMessage,
    RequestCancelledMessage,
    ResponseChunkMessage,
    ResponseCompleteMessage,
    StartListeningMessage,
    StateChangeMessage,
    StopSpeakingMessage,
    ThinkingStartedMessage,
    ToolExecutionCompletedMessage,
    ToolExecutionStartedMessage,
    TranscriptionCompletedMessage,
    TranscriptionStartedMessage,
    UserMessage,
    WSMessageType,
    WSClientMessage,
)
from app.services.conversation_service import get_conversation_service
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

router = APIRouter()


@dataclass
class ActiveRequest:
    """Tracks an active request for cancellation support."""
    request_id: str
    conversation_id: int
    task: asyncio.Task | None = None
    cancelled: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}
        self.active_requests: dict[str, ActiveRequest] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, conversation_id: int):
        await websocket.accept()
        async with self._lock:
            self.active_connections[conversation_id] = websocket

    async def disconnect(self, conversation_id: int):
        async with self._lock:
            self.active_connections.pop(conversation_id, None)
            # Cancel all active requests for this conversation
            to_cancel = [
                req for req in self.active_requests.values()
                if req.conversation_id == conversation_id
            ]
            for req in to_cancel:
                await self.cancel_request(req.request_id)

    def get_websocket(self, conversation_id: int) -> WebSocket | None:
        return self.active_connections.get(conversation_id)

    async def send_message(self, conversation_id: int, message: AnyServerMessage):
        websocket = self.get_websocket(conversation_id)
        if websocket:
            try:
                await websocket.send_text(message.model_dump_json(exclude_none=True))
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                await self.disconnect(conversation_id)

    def create_request(self, conversation_id: int, request_id: str | None = None) -> ActiveRequest:
        req_id = request_id or str(uuid.uuid4())
        request = ActiveRequest(request_id=req_id, conversation_id=conversation_id)
        self.active_requests[req_id] = request
        return request

    def get_request(self, request_id: str) -> ActiveRequest | None:
        return self.active_requests.get(request_id)

    async def cancel_request(self, request_id: str) -> bool:
        async with self._lock:
            request = self.active_requests.get(request_id)
            if not request:
                return False
            
            request.cancelled = True
            
            # Cancel LLM task
            if request.task and not request.task.done():
                request.task.cancel()
            
            # Clean up
            self.active_requests.pop(request_id, None)
            return True

    def is_request_active(self, request_id: str) -> bool:
        request = self.active_requests.get(request_id)
        return request is not None and not request.cancelled

    def cleanup_request(self, request_id: str):
        self.active_requests.pop(request_id, None)


manager = ConnectionManager()


@asynccontextmanager
async def request_context(conversation_id: int, request_id: str | None = None):
    """Context manager for request lifecycle."""
    request = manager.create_request(conversation_id, request_id=request_id)
    try:
        yield request
    finally:
        manager.cleanup_request(request.request_id)


async def send_state(conversation_id: int, request_id: str, state: AssistantState):
    from app.schemas.websocket import StateChangeMessage
    await manager.send_message(
        conversation_id,
        StateChangeMessage(
            request_id=request_id,
            conversation_id=conversation_id,
            data={"state": state.value},
        ),
    )


async def send_error(conversation_id: int, request_id: str | None, message: str, code: str):
    from app.schemas.websocket import ErrorMessage
    await manager.send_message(
        conversation_id,
        ErrorMessage(
            request_id=request_id or str(uuid.uuid4()),
            conversation_id=conversation_id,
            data={"message": message, "code": code},
        ),
    )


from app.schemas.websocket import (
    AnyServerMessage,
    AssistantState,
    CancelRequestMessage,
    ConversationCreatedMessage,
    ErrorMessage,
    NewConversationMessage,
    PingMessage,
    PongMessage,
    RequestCancelledMessage,
    ResponseChunkMessage,
    ResponseCompleteMessage,
    StartListeningMessage,
    StateChangeMessage,
    StopSpeakingMessage,
    ThinkingStartedMessage,
    ToolExecutionCompletedMessage,
    ToolExecutionStartedMessage,
    TranscriptionCompletedMessage,
    TranscriptionStartedMessage,
    UserMessage,
    WSMessageType,
    WSClientMessage,
)


@router.websocket("/ws/conversation/{conversation_id}")
async def websocket_conversation(
    websocket: WebSocket,
    conversation_id: int,
    db: Session = Depends(get_db),
):
    await manager.connect(websocket, conversation_id)

    service = get_conversation_service(db)
    conversation = service.get_conversation(conversation_id)

    if not conversation:
        await send_error(conversation_id, None, "Conversation not found", "NOT_FOUND")
        await websocket.close(code=4004)
        return

    try:
        await send_state(conversation_id, str(uuid.uuid4()), AssistantState.IDLE)

        while True:
            data = await websocket.receive_text()
            try:
                raw = json.loads(data)
                msg_type = raw.get("type")
                
                # Parse with proper model based on type
                message: PingMessage | NewConversationMessage | UserMessage | CancelRequestMessage | WSClientMessage
                if msg_type == WSMessageType.PING.value:
                    message = PingMessage.model_validate(raw)
                elif msg_type == WSMessageType.NEW_CONVERSATION.value:
                    message = NewConversationMessage.model_validate(raw)
                elif msg_type == WSMessageType.USER_MESSAGE.value:
                    message = UserMessage.model_validate(raw)
                elif msg_type == WSMessageType.CANCEL_REQUEST.value:
                    message = CancelRequestMessage.model_validate(raw)
                elif msg_type == WSMessageType.START_LISTENING.value:
                    message = StartListeningMessage.model_validate(raw)
                elif msg_type == WSMessageType.STOP_SPEAKING.value:
                    message = StopSpeakingMessage.model_validate(raw)
                else:
                    message = WSClientMessage.model_validate(raw)
            except Exception as e:
                await send_error(conversation_id, None, f"Invalid message format: {e}", "INVALID_FORMAT")
                continue

            request_id = message.request_id

            if isinstance(message, PingMessage):
                from app.schemas.websocket import PongMessage
                await manager.send_message(
                    conversation_id,
                    PongMessage(request_id=request_id, conversation_id=conversation_id),
                )
                continue

            if isinstance(message, StartListeningMessage):
                await send_state(conversation_id, request_id, AssistantState.LISTENING)
                continue

            if isinstance(message, StopSpeakingMessage):
                await send_state(conversation_id, request_id, AssistantState.IDLE)
                continue

            if isinstance(message, NewConversationMessage):
                new_conv = service.create_conversation()
                from app.schemas.websocket import ConversationCreatedMessage
                await manager.send_message(
                    conversation_id,
                    ConversationCreatedMessage(
                        request_id=request_id,
                        conversation_id=conversation_id,
                        data={"conversation_id": new_conv.id},
                    ),
                )
                continue

            if isinstance(message, CancelRequestMessage):
                cancelled = await manager.cancel_request(request_id)
                if cancelled:
                    from app.schemas.websocket import RequestCancelledMessage
                    await manager.send_message(
                        conversation_id,
                        RequestCancelledMessage(
                            request_id=request_id,
                            conversation_id=conversation_id,
                            data={"request_id": request_id},
                        ),
                    )
                    await send_state(conversation_id, request_id, AssistantState.INTERRUPTED)
                continue

            if isinstance(message, UserMessage):
                content = message.data.get("content", "")
                if content:
                    await handle_user_message(
                        websocket, conversation_id, service, content, request_id
                    )
                continue

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for conversation {conversation_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await send_error(conversation_id, None, str(e), "SERVER_ERROR")
    finally:
        await manager.disconnect(conversation_id)


async def handle_user_message(
    websocket: WebSocket,
    conversation_id: int,
    service,
    content: str,
    request_id: str,
):
    """Handle a user message with streaming and tool execution."""
    
    import time
    request_start = time.monotonic()
    
    logger.info(
        "request_started",
        extra={
            "request_id": request_id,
            "conversation_id": conversation_id,
            "content_length": len(content),
        },
    )
    
    async with request_context(conversation_id, request_id=request_id) as request:
        if manager.is_request_active(request_id) is False:
            logger.warning(
                "request_rejected_not_active",
                extra={"request_id": request_id},
            )
            return

        await send_state(conversation_id, request_id, AssistantState.THINKING)
        from app.schemas.websocket import ThinkingStartedMessage
        await manager.send_message(
            conversation_id,
            ThinkingStartedMessage(request_id=request_id, conversation_id=conversation_id),
        )

        try:
            # Persist user message to DB
            service.add_message(
                conversation_id,
                MessageCreate(role=MessageRole.user, content=content),
            )

            messages = service.get_messages_for_llm(conversation_id)

            full_response = ""
            llm_start = time.monotonic()
            first_token_time = None
            
            async for content_chunk, tool_results in llm_service.stream_with_tools(
                messages, temperature=0.7, max_tokens=None
            ):
                # Check if request was cancelled
                if not manager.is_request_active(request_id):
                    logger.info(
                        "request_cancelled_during_processing",
                        extra={"request_id": request_id},
                    )
                    return
                
                if content_chunk:
                    if first_token_time is None:
                        first_token_time = time.monotonic()
                        logger.info(
                            "llm_first_token",
                            extra={
                                "request_id": request_id,
                                "latency_ms": int((first_token_time - llm_start) * 1000),
                            },
                        )
                    full_response += content_chunk
                    await manager.send_message(
                        conversation_id,
                        ResponseChunkMessage(
                            request_id=request_id,
                            conversation_id=conversation_id,
                            data={"content": content_chunk},
                        ),
                    )
                
                if tool_results:
                    await send_state(conversation_id, request_id, AssistantState.EXECUTING_TOOL)
                    for tool_result in tool_results:
                        tool_name = tool_result["tool_name"]
                        tool_start = time.monotonic()
                        from app.schemas.websocket import ToolExecutionStartedMessage, ToolExecutionCompletedMessage
                        await manager.send_message(
                            conversation_id,
                            ToolExecutionStartedMessage(
                                request_id=request_id,
                                conversation_id=conversation_id,
                                data={"name": tool_name, "args": tool_result.get("args", {})},
                            ),
                        )
                        await manager.send_message(
                            conversation_id,
                            ToolExecutionCompletedMessage(
                                request_id=request_id,
                                conversation_id=conversation_id,
                                data={
                                    "name": tool_name,
                                    "result": tool_result.get("result"),
                                    "error": tool_result.get("error"),
                                },
                            ),
                        )
                        logger.info(
                            "tool_executed",
                            extra={
                                "request_id": request_id,
                                "tool_name": tool_name,
                                "duration_ms": int((time.monotonic() - tool_start) * 1000),
                                "success": tool_result.get("error") is None,
                            },
                        )
                    await send_state(conversation_id, request_id, AssistantState.THINKING)

            if not manager.is_request_active(request_id):
                return

            if not full_response.strip():
                await send_error(conversation_id, request_id, "Empty response from AI", "EMPTY_RESPONSE")
                await send_state(conversation_id, request_id, AssistantState.IDLE)
                return

            await manager.send_message(
                conversation_id,
                ResponseCompleteMessage(
                    request_id=request_id,
                    conversation_id=conversation_id,
                ),
            )

            # Persist assistant response to DB
            service.add_message(
                conversation_id,
                MessageCreate(role=MessageRole.assistant, content=full_response.strip()),
            )

            # Auto-generate title in background if conversation title is empty
            conv = service.get_conversation(conversation_id)
            if conv and not conv.title:
                asyncio.create_task(service.generate_title(conversation_id))

            llm_duration = time.monotonic() - llm_start
            logger.info(
                "llm_completed",
                extra={
                    "request_id": request_id,
                    "duration_ms": int(llm_duration * 1000),
                    "response_length": len(full_response),
                    "first_token_ms": int((first_token_time - llm_start) * 1000) if first_token_time else None,
                },
            )

            # Response complete - frontend will handle TTS via browser SpeechSynthesis
            await send_state(conversation_id, request_id, AssistantState.IDLE)

            total_duration = time.monotonic() - request_start
            logger.info(
                "request_completed",
                extra={
                    "request_id": request_id,
                    "conversation_id": conversation_id,
                    "total_duration_ms": int(total_duration * 1000),
                },
            )

        except asyncio.CancelledError:
            logger.info(
                "request_cancelled",
                extra={"request_id": request_id},
            )
            await send_state(conversation_id, request_id, AssistantState.INTERRUPTED)
            raise
        except Exception as e:
            logger.error(
                "request_error",
                extra={"request_id": request_id, "error": str(e)},
            )
            await send_error(conversation_id, request_id, f"Processing error: {str(e)}", "PROCESSING_ERROR")
            await send_state(conversation_id, request_id, AssistantState.ERROR)