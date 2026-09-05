from abc import ABC, abstractmethod
from typing import Any

from app.schemas.tools import ToolParameter, ToolResult, ToolSchema


class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        pass

    @property
    @abstractmethod
    def parameters(self) -> dict[str, ToolParameter]:
        pass

    @property
    def required(self) -> list[str]:
        return []

    @abstractmethod
    async def execute(self, *args: Any, **kwargs: Any) -> ToolResult:
        pass

    def to_schema(self) -> ToolSchema:
        return ToolSchema(
            name=self.name,
            description=self.description,
            parameters=self.parameters,
            required=self.required,
        )
