from typing import Any
import asyncio

from app.schemas.tools import ToolResult, ToolSchema
from app.tools.base import BaseTool
from app.tools.calculator import CalculatorTool
from app.tools.time_tool import TimeTool
from app.tools.weather import WeatherTool


class ToolService:
    def __init__(self, default_timeout: float = 30.0):
        self._tools: dict[str, BaseTool] = {}
        self._default_timeout = default_timeout
        self._register_default_tools()

    def _register_default_tools(self):
        self.register(CalculatorTool())
        self.register(TimeTool())
        self.register(WeatherTool())

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def get_all_schemas(self) -> list[ToolSchema]:
        return [tool.to_schema() for tool in self._tools.values()]

    async def execute(self, name: str, **kwargs: Any) -> ToolResult:
        tool = self.get_tool(name)
        if not tool:
            return ToolResult(success=False, error=f"Tool not found: {name}")
        try:
            return await asyncio.wait_for(tool.execute(**kwargs), timeout=self._default_timeout)
        except asyncio.TimeoutError:
            return ToolResult(success=False, error=f"Tool execution timed out after {self._default_timeout}s")
        except Exception as e:
            return ToolResult(success=False, error=f"Tool execution failed: {str(e)}")

    def get_tool_names(self) -> list[str]:
        return list(self._tools.keys())


tool_service = ToolService()
