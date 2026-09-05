from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator


class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        pass

    @abstractmethod
    async def stream_synthesize(self, text: str) -> AsyncGenerator[bytes, None]:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass
