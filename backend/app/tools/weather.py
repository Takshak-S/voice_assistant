import httpx

from app.core.config import get_settings
from app.schemas.tools import ToolParameter, ToolResult
from app.tools.base import BaseTool


class WeatherTool(BaseTool):
    @property
    def name(self) -> str:
        return "get_weather"

    @property
    def description(self) -> str:
        return "Get current weather information for a location using Open-Meteo (free)."

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "location": ToolParameter(
                type="string",
                description="City name, optionally with country code (e.g., 'London', 'London,UK', 'New York,US')",
            ),
            "units": ToolParameter(
                type="string",
                description="Temperature units: 'metric' (Celsius), 'imperial' (Fahrenheit), or 'standard' (Kelvin)",
                enum=["metric", "imperial", "standard"],
            ),
        }

    @property
    def required(self) -> list[str]:
        return ["location"]

    async def _geocode(self, location: str) -> tuple[float, float] | None:
        """Get latitude and longitude for a location using Open-Meteo geocoding."""
        settings = get_settings()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{settings.geocoding_base_url}/search",
                    params={
                        "name": location,
                        "count": 1,
                        "language": "en",
                        "format": "json",
                    },
                )
                if response.status_code != 200:
                    return None
                data = response.json()
                results = data.get("results", [])
                if not results:
                    return None
                first = results[0]
                return (first["latitude"], first["longitude"])
        except Exception:
            return None

    async def execute(self, location: str, units: str = "metric") -> ToolResult:
        settings = get_settings()

        # Convert units to Open-Meteo format
        unit_map = {
            "metric": "celsius",
            "imperial": "fahrenheit",
            "standard": "kelvin",
        }
        open_meteo_unit = unit_map.get(units, "celsius")

        # Geocode the location
        coords = await self._geocode(location)
        if not coords:
            return ToolResult(success=False, error=f"Location not found: {location}")

        latitude, longitude = coords

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{settings.weather_base_url}/forecast",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "current_weather": "true",
                        "temperature_unit": open_meteo_unit,
                        "wind_speed_unit": "kmh" if units == "metric" else "mph",
                        "precipitation_unit": "mm",
                        "timezone": "auto",
                    },
                )

                if response.status_code != 200:
                    return ToolResult(success=False, error=f"Weather API error: {response.status_code}")

                data = response.json()
                current = data.get("current_weather", {})

                if not current:
                    return ToolResult(success=False, error="No weather data available")

                return ToolResult(
                    success=True,
                    result={
                        "location": location,
                        "latitude": latitude,
                        "longitude": longitude,
                        "temperature": current.get("temperature"),
                        "wind_speed": current.get("windspeed"),
                        "wind_direction": current.get("winddirection"),
                        "weather_code": current.get("weathercode"),
                        "time": current.get("time"),
                        "units": units,
                    }
                )

        except httpx.TimeoutException:
            return ToolResult(success=False, error="Weather request timed out")
        except Exception as e:
            return ToolResult(success=False, error=f"Weather lookup error: {str(e)}")