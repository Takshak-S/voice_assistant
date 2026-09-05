from abc import ABC, abstractmethod
from typing import BinaryIO


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_file: BinaryIO, filename: str = "audio.webm") -> str:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass
