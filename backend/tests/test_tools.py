import pytest
from app.tools.calculator import CalculatorTool
from app.tools.time_tool import TimeTool
from app.tools.weather import WeatherTool
from app.schemas.tools import ToolResult


class TestCalculatorTool:
    @pytest.fixture
    def calculator(self):
        return CalculatorTool()

    @pytest.mark.asyncio
    async def test_simple_addition(self, calculator):
        result = await calculator.execute(expression="2 + 3")
        assert result.success
        assert result.result == 5

    @pytest.mark.asyncio
    async def test_multiplication(self, calculator):
        result = await calculator.execute(expression="6 * 7")
        assert result.success
        assert result.result == 42

    @pytest.mark.asyncio
    async def test_division(self, calculator):
        result = await calculator.execute(expression="20 / 4")
        assert result.success
        assert result.result == 5.0

    @pytest.mark.asyncio
    async def test_complex_expression(self, calculator):
        result = await calculator.execute(expression="(2 + 3) * 4")
        assert result.success
        assert result.result == 20

    @pytest.mark.asyncio
    async def test_power(self, calculator):
        result = await calculator.execute(expression="2 ** 10")
        assert result.success
        assert result.result == 1024

    @pytest.mark.asyncio
    async def test_modulo(self, calculator):
        result = await calculator.execute(expression="17 % 5")
        assert result.success
        assert result.result == 2

    @pytest.mark.asyncio
    async def test_empty_expression(self, calculator):
        result = await calculator.execute(expression="")
        assert not result.success
        assert "Empty" in result.error

    @pytest.mark.asyncio
    async def test_division_by_zero(self, calculator):
        result = await calculator.execute(expression="10 / 0")
        assert not result.success
        assert "Division by zero" in result.error

    @pytest.mark.asyncio
    async def test_invalid_expression(self, calculator):
        result = await calculator.execute(expression="2 + * 3")
        assert not result.success
        assert "Invalid" in result.error


class TestTimeTool:
    @pytest.fixture
    def time_tool(self):
        return TimeTool()

    @pytest.mark.asyncio
    async def test_utc_time(self, time_tool):
        result = await time_tool.execute(timezone="UTC")
        assert result.success
        assert "timezone" in result.result
        assert result.result["timezone"] == "UTC"
        assert "current_time" in result.result
        assert "iso_format" in result.result

    @pytest.mark.asyncio
    async def test_named_timezone(self, time_tool):
        result = await time_tool.execute(timezone="America/New_York")
        assert result.success
        assert result.result["timezone"] == "America/New_York"

    @pytest.mark.asyncio
    async def test_invalid_timezone(self, time_tool):
        result = await time_tool.execute(timezone="Invalid/Timezone")
        assert not result.success
        assert "Unknown timezone" in result.error


class TestWeatherTool:
    @pytest.fixture
    def weather_tool(self):
        return WeatherTool()

    @pytest.mark.asyncio
    async def test_valid_location(self, weather_tool):
        result = await weather_tool.execute(location="London")
        # Should succeed with Open-Meteo (no API key needed)
        assert result.success
        assert result.result is not None
        assert "location" in result.result
        assert "temperature" in result.result

    @pytest.mark.asyncio
    async def test_invalid_location(self, weather_tool):
        result = await weather_tool.execute(location="InvalidLocationXYZ123")
        # Should fail gracefully for unknown location
        assert not result.success
        assert "not found" in result.error.lower() or "location" in result.error.lower()

    @pytest.mark.asyncio
    async def test_units_metric(self, weather_tool):
        result = await weather_tool.execute(location="London", units="metric")
        assert result.success
        assert result.result["units"] == "metric"

    @pytest.mark.asyncio
    async def test_units_imperial(self, weather_tool):
        result = await weather_tool.execute(location="London", units="imperial")
        # Open-Meteo may occasionally return 503; accept either success or 503 error
        if not result.success and "503" in str(result.error):
            pytest.skip("Open-Meteo API returned 503 (temporary service issue)")
        assert result.success
        assert result.result["units"] == "imperial"