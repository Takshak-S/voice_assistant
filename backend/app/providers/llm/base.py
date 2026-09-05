from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from app.schemas.tools import ToolSchema


class StreamChunk:
    """Represents a chunk from the streaming LLM response."""
    def __init__(self, content: str | None = None, tool_calls: list[Any] | None = None):
        self.content = content
        self.tool_calls = tool_calls


class LLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        messages: list[dict],
        tools: list[ToolSchema] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict:
        pass

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        tools: list[ToolSchema] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass
