from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.providers.tts.base import TTSProvider


class OpenAITTSProvider(TTSProvider):
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.openai_api_key:
            raise ValueError("OpenAI API key is required for TTS")
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    async def synthesize(self, text: str) -> bytes:
        response = await self.client.audio.speech.create(
            model=self.settings.openai_tts_model,
            voice=self.settings.openai_tts_voice,
            input=text,
            response_format="mp3",
        )
        return response.content  # type: ignore[no-any-return]

    async def stream_synthesize(self, text: str) -> AsyncGenerator[bytes, None]:  # type: ignore[override]
        async with self.client.audio.speech.with_streaming_response.create(
            model=self.settings.openai_tts_model,
            voice=self.settings.openai_tts_voice,
            input=text,
            response_format="mp3",
        ) as response:
            async for chunk in response.iter_bytes(chunk_size=1024):
                yield chunk

    async def close(self) -> None:
        await self.client.close()
