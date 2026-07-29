"""Application configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration. Values are injected via environment variables or .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ML container connection
    ml_service_url: str = "http://localhost:8000"

    # Server bind
    estimator_api_host: str = "0.0.0.0"
    estimator_api_port: int = 8001

    # Logging
    log_level: str = "INFO"


settings = Settings()
