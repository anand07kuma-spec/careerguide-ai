"""Application settings loaded from environment / .env."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# `psycopg` is the PostgreSQL driver in requirements.txt. A host that hands over a
# plain `postgresql://` URL (Vercel's database integrations do) would otherwise send
# SQLAlchemy looking for psycopg2, which is not installed here.
BARE_PG_SCHEMES = ("postgres://", "postgresql://")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "CareerGuide AI"
    database_url: str = "sqlite:///./careerguide.db"

    @field_validator("database_url")
    @classmethod
    def use_the_shipped_postgres_driver(cls, value: str) -> str:
        for scheme in BARE_PG_SCHEMES:
            if value.startswith(scheme):
                return "postgresql+psycopg://" + value[len(scheme) :]
        return value

    # Creating the tables and seeding the catalogue happens on the first boot.
    # Set DB_AUTO_SETUP=false once the database is prepared, so a serverless cold
    # start does not run schema DDL on every new instance.
    db_auto_setup: bool = True
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://careerguide.localhost:3000"
    )

    # AI provider. Leave ai_provider="demo" until real credentials exist.
    ai_provider: str = "demo"
    ai_api_key: str = ""
    ai_model: str = ""
    ai_base_url: str = "https://api.openai.com/v1"

    # Text-to-speech voices. Hindi and English. The same Microsoft neural voice
    # ids work on both transports below.
    tts_voice_hi: str = "hi-IN-SwaraNeural"
    tts_voice_en: str = "en-IN-NeerjaNeural"
    tts_timeout_seconds: int = 25

    # auto = the best configured service for this host, in the order below.
    # Microsoft's Edge read-aloud endpoint answers 403 to datacenter egress IPs, so
    # a deployment on serverless hosting needs gemini or azure. Forcing a provider
    # whose key is missing fails loudly instead of silently downgrading.
    tts_provider: str = "auto"
    azure_speech_key: str = ""
    # The Speech resource's own region, e.g. "eastus". The key only works there.
    azure_speech_region: str = ""

    gemini_api_key: str = ""
    gemini_tts_model: str = "gemini-3.8-flash-tts"
    # One voice carries Hindi, English and Hinglish: Gemini reads the script of the
    # text it is given. "Sulafat" is Google's warmest prebuilt voice.
    gemini_voice: str = "Sulafat"

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
