from datetime import datetime

from app.schemas.tools import ToolParameter, ToolResult
from app.tools.base import BaseTool

try:
    import zoneinfo
    ZONEINFO_AVAILABLE = True
except ImportError:
    ZONEINFO_AVAILABLE = False


class TimeTool(BaseTool):
    @property
    def name(self) -> str:
        return "get_time"

    @property
    def description(self) -> str:
        return "Get the current time for a specific timezone."

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "timezone": ToolParameter(
                type="string",
                description="IANA timezone name (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'). Defaults to UTC.",
            ),
        }

    async def execute(self, timezone: str = "UTC") -> ToolResult:
        try:
            if ZONEINFO_AVAILABLE:
                try:
                    tz = zoneinfo.ZoneInfo(timezone)
                except zoneinfo.ZoneInfoNotFoundError:
                    return ToolResult(
                        success=False,
                        error=f"Unknown timezone: {timezone}. Use IANA timezone names like 'America/New_York', 'Europe/London', 'Asia/Tokyo'."
                    )
                now = datetime.now(tz)
            else:
                if timezone != "UTC":
                    return ToolResult(
                        success=False,
                        error="Timezone support requires Python 3.9+ or backports.zoneinfo. Only UTC is supported."
                    )
                now = datetime.utcnow()

            return ToolResult(
                success=True,
                result={
                    "timezone": timezone,
                    "current_time": now.strftime("%Y-%m-%d %H:%M:%S %Z%z"),
                    "iso_format": now.isoformat(),
                }
            )
        except Exception as e:
            return ToolResult(success=False, error=f"Time lookup error: {str(e)}")
