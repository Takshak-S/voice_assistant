"""
STT Service - Powered by Groq Whisper (whisper-large-v3-turbo)
with fallback to OpenAI Whisper.
"""

from typing import BinaryIO, Optional
import httpx
from app.core.config import get_settings


class STTService:
    """High-speed speech-to-text service using Groq Whisper."""

    def __init__(self):
        self.settings = get_settings()

    async def transcribe(
        self,
        audio_file: BinaryIO | bytes,
        filename: str = "audio.webm",
        language: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio using Groq Whisper API (whisper-large-v3-turbo)
        or OpenAI Whisper API.
        """
        if isinstance(audio_file, bytes):
            audio_bytes = audio_file
        else:
            audio_bytes = audio_file.read()

        if not audio_bytes:
            raise ValueError("Audio data is empty")

        # Determine language prefix (e.g. 'en' from 'en-US')
        lang_code = language.split("-")[0].lower() if language else None

        # Try Groq Whisper first (fastest, free tier supported)
        if self.settings.llm_api_key or self.settings.llm_provider == "groq":
            api_key = self.settings.llm_api_key
            if api_key:
                headers = {"Authorization": f"Bearer {api_key}"}
                files = {"file": (filename, audio_bytes, "audio/webm")}
                data = {
                    "model": "whisper-large-v3-turbo",
                    "response_format": "json",
                }
                if lang_code:
                    data["language"] = lang_code

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/audio/transcriptions",
                        headers=headers,
                        files=files,
                        data=data,
                    )
                    if response.status_code == 200:
                        result = response.json()
                        return result.get("text", "").strip()
                    else:
                        error_detail = response.text
                        raise RuntimeError(f"Groq Whisper transcription failed ({response.status_code}): {error_detail}")

        # Fallback to OpenAI Whisper if configured
        if self.settings.openai_api_key:
            headers = {"Authorization": f"Bearer {self.settings.openai_api_key}"}
            files = {"file": (filename, audio_bytes, "audio/webm")}
            data = {"model": self.settings.openai_stt_model}
            if lang_code:
                data["language"] = lang_code

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data,
                )
                if response.status_code == 200:
                    result = response.json()
                    return result.get("text", "").strip()
                else:
                    raise RuntimeError(f"OpenAI Whisper transcription failed ({response.status_code}): {response.text}")

        raise RuntimeError("No STT provider configured. Please provide a Groq or OpenAI API key.")

    async def close(self):
        pass


stt_service = STTService()