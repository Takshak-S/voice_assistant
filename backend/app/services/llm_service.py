from collections.abc import AsyncGenerator
from typing import Any

from app.core.config import get_settings
from app.providers.llm.base import LLMProvider
from app.providers.llm.groq_provider import GroqLLMProvider
from app.providers.llm.openai_provider import OpenAILLMProvider
from app.schemas.tools import ToolSchema
from app.services.tool_service import tool_service


class LLMProviderFactory:
    """Factory for creating LLM provider instances."""
    
    @staticmethod
    def create_provider(provider_name: str | None = None) -> LLMProvider:
        settings = get_settings()
        provider_name = provider_name or settings.llm_provider
        
        if provider_name == "groq":
            return GroqLLMProvider()
        elif provider_name == "openai":
            return OpenAILLMProvider()
        elif provider_name == "gemini":
            try:
                from app.providers.llm.gemini_provider import GeminiLLMProvider
                return GeminiLLMProvider()
            except ImportError:
                raise ValueError("Gemini provider requires google-generativeai package")
        else:
            raise ValueError(f"Unsupported LLM provider: {provider_name}. Supported: groq, openai, gemini")


class LLMService:
    def __init__(self):
        self._provider: LLMProvider | None = None
        self._system_prompt = (
            "You are a helpful, friendly voice assistant. "
            "Keep responses concise and conversational since they will be spoken aloud. "
            "Do NOT use markdown formatting (such as asterisks for bold or italics, hashes for headers, or bullet points) in your responses because they will be read aloud by text-to-speech. "
            "Use tools when appropriate to answer questions. "
            "If you don't know something, say so honestly."
        )

    @property
    def provider(self) -> LLMProvider:
        if self._provider is None:
            self._provider = LLMProviderFactory.create_provider()
        return self._provider

    @property
    def system_prompt(self) -> str:
        return self._system_prompt  # type: ignore[no-any-return]

    @system_prompt.setter
    def system_prompt(self, value: str):
        self._system_prompt = value

    def get_tool_schemas(self) -> list[ToolSchema]:
        return tool_service.get_all_schemas()

    async def generate(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict:
        return await self.provider.generate(
            messages=messages,
            tools=self.get_tool_schemas(),
            temperature=temperature,
            max_tokens=max_tokens,
        )  # type: ignore[no-any-return]

    async def stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[Any, None]:
        """Stream response chunks from the LLM provider."""
        async for chunk in self.provider.stream(
            messages=messages,
            tools=self.get_tool_schemas(),
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield chunk

    async def stream_with_tools(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[tuple[str, list[dict] | None], None]:
        """
        Stream response with tool execution.
        Yields tuples of (content_chunk, tool_results).
        tool_results is None when no tool call, otherwise list of executed tool results.
        """
        messages = messages.copy()
        
        while True:
            tool_calls_made = []
            full_response = ""
            
            async for chunk in self.provider.stream(
                messages=messages,
                tools=self.get_tool_schemas(),
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                if chunk.content:
                    full_response += chunk.content
                    yield chunk.content, None
                
                if chunk.tool_calls:
                    tool_calls_made.extend(chunk.tool_calls)
            
            if not tool_calls_made:
                # No more tool calls, we're done
                break
            
            # Execute tool calls
            for tool_call in tool_calls_made:
                tool_name = tool_call.function.name
                tool_args = tool_call.function.arguments
                
                import json
                try:
                    args = json.loads(tool_args)
                except json.JSONDecodeError:
                    args = {}
                
                from app.schemas.tools import ToolResult
                result: ToolResult = await tool_service.execute(tool_name, **args)
                
                tool_result_data = {
                    "tool_name": tool_name,
                    "args": args,
                    "result": result.result if result.success else None,
                    "error": result.error if not result.success else None,
                }
                
                # Add tool result to messages
                messages.append({
                    "role": "tool",
                    "content": result.error if not result.success else str(result.result),
                    "tool_call_id": tool_call.id,
                    "name": tool_name,
                })
                
                yield "", [tool_result_data]
            
            # Continue the loop to let LLM respond to tool results
            # The next iteration will stream the response to tool results
            continue

    async def close(self):
        if self._provider:
            await self._provider.close()
            self._provider = None


llm_service = LLMService()