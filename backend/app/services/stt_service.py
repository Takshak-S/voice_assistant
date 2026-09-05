"""
STT Service - Browser-based Speech Recognition

Since we use browser-based Speech Recognition API (Web Speech API),
this service is a no-op on the backend. The frontend handles
speech recognition directly using the browser's Web Speech API.

This service exists for API compatibility and future extensibility.
"""

from typing import BinaryIO


class STTService:
    """No-op STT service - transcription happens in the browser."""
    
    def __init__(self):
        self._provider = None

    async def transcribe(self, audio_file, filename: str = "audio.webm") -> str:
        """
        Placeholder for API compatibility.
        In the free-by-default architecture, transcription happens in the browser.
        This method should not be called in normal operation.
        """
        raise NotImplementedError(
            "Backend STT is not available in free-by-default mode. "
            "Use browser Web Speech API (SpeechRecognition) for transcription."
        )

    async def close(self):
        pass


stt_service = STTService()