"""
TTS Service - Browser-based Speech Synthesis

Since we use browser-based Speech Synthesis API (Web Speech API),
this service is a no-op on the backend. The frontend handles
speech synthesis directly using the browser's Web Speech API.

This service exists for API compatibility and future extensibility.
"""

from collections.abc import AsyncGenerator


class TTSService:
    """No-op TTS service - synthesis happens in the browser."""
    
    def __init__(self):
        self._provider = None

    async def synthesize(self, text: str) -> bytes:
        """
        Placeholder for API compatibility.
        In the free-by-default architecture, synthesis happens in the browser.
        This method should not be called in normal operation.
        """
        raise NotImplementedError(
            "Backend TTS is not available in free-by-default mode. "
            "Use browser Web Speech API (SpeechSynthesis) for synthesis."
        )

    async def stream_synthesize(self, text: str) -> AsyncGenerator[bytes, None]:
        """
        Placeholder for API compatibility.
        In the free-by-default architecture, streaming synthesis happens in the browser.
        This method should not be called in normal operation.
        """
        raise NotImplementedError(
            "Backend TTS streaming is not available in free-by-default mode. "
            "Use browser Web Speech API (SpeechSynthesis) for synthesis."
        )

    async def close(self):
        pass


tts_service = TTSService()