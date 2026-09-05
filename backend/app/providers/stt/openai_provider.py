from typing import BinaryIO

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.providers.stt.base import STTProvider


class OpenAISTTProvider(STTProvider):
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.openai_api_key:
            raise ValueError("OpenAI API key is required for STT")
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    async def transcribe(self, audio_file: BinaryIO, filename: str = "audio.webm") -> str:
        response = await self.client.audio.transcriptions.create(
            model=self.settings.openai_stt_model,
            file=(filename, audio_file, "audio/webm"),
            response_format="text",
        )
        return response.strip()  # type: ignore[no-any-return]

    async def close(self) -> None:
        await self.client.close()
