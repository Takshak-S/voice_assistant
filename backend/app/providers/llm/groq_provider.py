from collections.abc import AsyncGenerator
from typing import Any

from groq import AsyncGroq

from app.core.config import get_settings
from app.providers.llm.base import LLMProvider, StreamChunk
from app.schemas.tools import ToolSchema


class GroqLLMProvider(LLMProvider):
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.llm_api_key:
            raise ValueError("Groq API key is required. Set LLM_API_KEY environment variable.")
        self.client = AsyncGroq(api_key=self.settings.llm_api_key)

    def _convert_tools(self, tools: list[ToolSchema] | None) -> list[dict] | None:
        """Convert tool schemas to Groq/OpenAI function format."""
        if not tools:
            return None
        return [tool.to_openai_function() for tool in tools]

    async def generate(
        self,
        messages: list[dict],
        tools: list[ToolSchema] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict:
        groq_tools = self._convert_tools(tools)

        response = await self.client.chat.completions.create(
            model=self.settings.llm_model,
            messages=messages,
            tools=groq_tools,
            tool_choice="auto" if groq_tools else None,
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
        groq_tools = self._convert_tools(tools)

        stream = await self.client.chat.completions.create(
            model=self.settings.llm_model,
            messages=messages,
            tools=groq_tools,
            tool_choice="auto" if groq_tools else None,
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