from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class ToolParameter(BaseModel):
    type: str
    description: str
    enum: list[str] | None = None


class ToolSchema(BaseModel):
    name: str
    description: str
    parameters: dict[str, ToolParameter]
    required: list[str] = []

    def to_openai_function(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        k: v.model_dump(exclude_none=True) for k, v in self.parameters.items()
                    },
                    "required": self.required,
                },
            },
        }


class ToolResult(BaseModel):
    success: bool
    result: Any = None
    error: str | None = None
