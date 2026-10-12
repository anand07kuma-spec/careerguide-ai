"""Application settings loaded from environment / .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "CareerGuide AI"
    database_url: str = "sqlite:///./careerguide.db"
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://careerguide.localhost:3000"
    )

    # AI provider. Leave ai_provider="demo" until real credentials exist.
    ai_provider: str = "demo"
    ai_api_key: str = ""
    ai_model: str = ""
    ai_base_url: str = "https://api.openai.com/v1"

    # Edge TTS voices. Hindi and English.
    tts_voice_hi: str = "hi-IN-SwaraNeural"
    tts_voice_en: str = "en-IN-NeerjaNeural"
    tts_timeout_seconds: int = 25

    session_token_ttl_hours: int = 720

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        return self.ai_provider.lower() != "demo" and bool(self.ai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
