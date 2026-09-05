from collections.abc import AsyncGenerator
from typing import Any

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.providers.llm.base import LLMProvider, StreamChunk
from app.schemas.tools import ToolSchema


class OpenAILLMProvider(LLMProvider):
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.openai_api_key:
            raise ValueError("OpenAI API key is required")
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    async def generate(
        self,
        messages: list[dict],
        tools: list[ToolSchema] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict:
        openai_tools = [tool.to_openai_function() for tool in tools] if tools else None

        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=messages,
            tools=openai_tools,
            tool_choice="auto" if openai_tools else None,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return {
            "content": response.choices[0].message.content,
            "tool_calls": response.choices[0].message.tool_calls,
        }

    async def stream(  # type: ignore[override]
        self,
        messages: list[dict],
        tools: list[ToolSchema] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        openai_tools = [tool.to_openai_function() for tool in tools] if tools else None

        stream = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=messages,
            tools=openai_tools,
            tool_choice="auto" if openai_tools else None,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield StreamChunk(content=delta.content)
            if delta.tool_calls:
                yield StreamChunk(tool_calls=delta.tool_calls)

    async def close(self) -> None:
        await self.client.close()
