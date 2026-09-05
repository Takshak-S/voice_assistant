from functools import lru_cache
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings
from pydantic_core import MultiHostUrl
from typing import Optional, Literal


class Settings(BaseSettings):
    app_name: str = "Real-Time Voice Assistant"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed CORS origins",
    )

    # PostgreSQL configuration
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "voice_assistant"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # Optional direct database URL (overrides postgres_* settings)
    database_url: Optional[str] = None

    # LLM Provider Configuration
    llm_provider: Literal["groq", "gemini", "openai"] = "groq"
    llm_api_key: Optional[str] = Field(default=None, description="API key for the selected LLM provider")
    llm_model: str = "qwen/qwen3.8-27b"  # Groq default

    # OpenAI (optional)
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key (optional)")
    openai_model: str = "gpt-4o"

    # Gemini (optional)
    gemini_api_key: Optional[str] = Field(default=None, description="Google Gemini API key (optional)")
    gemini_model: str = "gemini-1.5-flash"

    # STT/TTS - Browser-based by default (no backend API keys needed)
    # OpenAI STT/TTS (optional, for fallback)
    openai_stt_model: str = "whisper-1"
    openai_tts_model: str = "tts-1"
    openai_tts_voice: str = "alloy"

    # Weather - Open-Meteo (free, no API key required)
    weather_api_key: Optional[str] = Field(default=None, description="Weather API key (optional, not needed for Open-Meteo)")
    weather_base_url: str = "https://api.open-meteo.com/v1"
    geocoding_base_url: str = "https://geocoding-api.open-meteo.com/v1"

    max_conversation_history: int = 50
    request_timeout: int = 60
    log_level: str = "INFO"

    @computed_field  # type: ignore[misc]
    @property
    def sqlalchemy_database_uri(self) -> str:
        """Return the database URI for SQLAlchemy."""
        if self.database_url:
            return self.database_url
        return str(MultiHostUrl.build(
            scheme="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            path=self.postgres_db,
        ))

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
