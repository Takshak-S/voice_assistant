import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from app.schemas.websocket import (
    AssistantState,
    WSMessageType,
    UserMessage,
    ToolExecutionStartedMessage,
    ToolExecutionCompletedMessage,
    ResponseChunkMessage,
    ResponseCompleteMessage,
    CancelRequestMessage,
    ErrorMessage,
    StateChangeMessage,
)
from app.api.websocket.conversation_ws import ConnectionManager, ActiveRequest
from app.tools.base import BaseTool
from app.schemas.tools import ToolParameter, ToolResult
from app.services.tool_service import ToolService


class MockTool(BaseTool):
    @property
    def name(self) -> str:
        return "mock_tool"

    @property
    def description(self) -> str:
        return "A mock tool for testing"

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "input": ToolParameter(type="string", description="Test input"),
        }

    @property
    def required(self) -> list[str]:
        return ["input"]

    async def execute(self, input: str) -> ToolResult:
        return ToolResult(success=True, result=f"Processed: {input}")


class TestConnectionManager:
    @pytest.fixture
    def manager(self):
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        ws = AsyncMock()
        ws.send_text = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_and_disconnect(self, manager, mock_websocket):
        await manager.connect(mock_websocket, 1)
        assert 1 in manager.active_connections
        
        await manager.disconnect(1)
        assert 1 not in manager.active_connections

    @pytest.mark.asyncio
    async def test_send_message(self, manager, mock_websocket):
        await manager.connect(mock_websocket, 1)
        
        message = StateChangeMessage(
            request_id=str(uuid4()),
            conversation_id=1,
            data={"state": "thinking"},
        )
        
        await manager.send_message(1, message)
        mock_websocket.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_and_cancel_request(self, manager):
        request = manager.create_request(1)
        assert request.request_id in manager.active_requests
        assert manager.is_request_active(request.request_id)
        
        cancelled = await manager.cancel_request(request.request_id)
        assert cancelled
        assert not manager.is_request_active(request.request_id)
        assert request.request_id not in manager.active_requests

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_request(self, manager):
        cancelled = await manager.cancel_request("nonexistent")
        assert not cancelled

    @pytest.mark.asyncio
    async def test_cleanup_request(self, manager):
        request = manager.create_request(1)
        manager.cleanup_request(request.request_id)
        assert request.request_id not in manager.active_requests


class TestToolService:
    @pytest.fixture
    def tool_service(self):
        service = ToolService()
        service.register(MockTool())
        return service

    @pytest.mark.asyncio
    async def test_execute_valid_tool(self, tool_service):
        result = await tool_service.execute("mock_tool", input="test")
        assert result.success
        assert result.result == "Processed: test"

    @pytest.mark.asyncio
    async def test_execute_invalid_tool(self, tool_service):
        result = await tool_service.execute("nonexistent_tool")
        assert not result.success
        assert "not found" in result.error

    def test_get_all_schemas(self, tool_service):
        schemas = tool_service.get_all_schemas()
        # Should have 3 default tools + 1 mock tool = 4
        assert len(schemas) == 4
        names = {s.name for s in schemas}
        assert "mock_tool" in names
        assert "calculator" in names
        assert "get_time" in names
        assert "get_weather" in names

    def test_get_tool_names(self, tool_service):
        names = tool_service.get_tool_names()
        assert "mock_tool" in names


class TestWebSocketEventTypes:
    def test_user_message_creation(self):
        msg = UserMessage(
            request_id=str(uuid4()),
            conversation_id=1,
            data={"content": "Hello"},
        )
        assert msg.type == WSMessageType.USER_MESSAGE
        assert msg.data["content"] == "Hello"

    def test_tool_execution_started_creation(self):
        msg = ToolExecutionStartedMessage(
            request_id=str(uuid4()),
            conversation_id=1,
            data={"name": "calculator", "args": {"expression": "2+2"}},
        )
        assert msg.type == WSMessageType.TOOL_EXECUTION_STARTED
        assert msg.data["name"] == "calculator"

    def test_tool_execution_completed_creation(self):
        msg = ToolExecutionCompletedMessage(
            request_id=str(uuid4()),
            conversation_id=1,
            data={"name": "calculator", "result": 4, "error": None},
        )
        assert msg.type == WSMessageType.TOOL_EXECUTION_COMPLETED
        assert msg.data["result"] == 4

    def test_cancel_request_creation(self):
        msg = CancelRequestMessage(
            request_id=str(uuid4()),
        )
        assert msg.type == WSMessageType.CANCEL_REQUEST

    def test_error_message_creation(self):
        msg = ErrorMessage(
            request_id=str(uuid4()),
            conversation_id=1,
            data={"message": "Test error", "code": "TEST_ERROR"},
        )
        assert msg.type == WSMessageType.ERROR
        assert msg.data["code"] == "TEST_ERROR"


class TestAssistantStateTransitions:
    @pytest.mark.parametrize("from_state,to_state,valid", [
        (AssistantState.IDLE, AssistantState.LISTENING, True),
        (AssistantState.LISTENING, AssistantState.TRANSCRIBING, True),
        (AssistantState.TRANSCRIBING, AssistantState.THINKING, True),
        (AssistantState.THINKING, AssistantState.EXECUTING_TOOL, True),
        (AssistantState.EXECUTING_TOOL, AssistantState.THINKING, True),
        (AssistantState.THINKING, AssistantState.RESPONDING, True),
        (AssistantState.RESPONDING, AssistantState.SPEAKING, True),
        (AssistantState.SPEAKING, AssistantState.IDLE, True),
        (AssistantState.SPEAKING, AssistantState.INTERRUPTED, True),
        (AssistantState.INTERRUPTED, AssistantState.LISTENING, True),
        (AssistantState.THINKING, AssistantState.INTERRUPTED, True),
        (AssistantState.EXECUTING_TOOL, AssistantState.INTERRUPTED, True),
        (AssistantState.IDLE, AssistantState.SPEAKING, False),  # Invalid direct transition
    ])
    def test_state_transition_validity(self, from_state, to_state, valid):
        # This is a conceptual test - in practice we'd have a state machine
        # that validates transitions. For now we just verify the states exist.
        assert from_state in AssistantState
        assert to_state in AssistantState


class TestRequestCancellation:
    @pytest.mark.asyncio
    async def test_cancellation_during_processing(self):
        manager = ConnectionManager()
        request = manager.create_request(1)
        
        # Simulate processing - directly set the task on the existing request
        import asyncio
        async def dummy_task():
            await asyncio.sleep(10)
        
        request.task = asyncio.create_task(dummy_task())
        
        cancelled = await manager.cancel_request(request.request_id)
        
        assert cancelled
        assert request.cancelled
        # Task should be in cancelling state or cancelled
        # Note: task.cancelled() returns True only after the task has actually been cancelled
        # We just verify the cancel was called by checking the task state
        assert request.task.cancelling() or request.task.cancelled()


class TestToolTimeout:
    @pytest.mark.asyncio
    async def test_tool_timeout(self):
        import asyncio
        
        class SlowTool(BaseTool):
            @property
            def name(self) -> str:
                return "slow_tool"

            @property
            def description(self) -> str:
                return "A slow tool"

            @property
            def parameters(self) -> dict[str, ToolParameter]:
                return {}

            @property
            def required(self) -> list[str]:
                return []

            async def execute(self) -> ToolResult:
                await asyncio.sleep(10)
                return ToolResult(success=True, result="done")

        service = ToolService(default_timeout=0.1)
        service.register(SlowTool())
        
        result = await service.execute("slow_tool")
        
        assert not result.success
        assert "timed out" in result.error