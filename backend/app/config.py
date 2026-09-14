"""Application configuration via pydantic-settings."""
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration. Values can be overridden via environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://fleet:fleet@db:5432/fleet"

    # ── JWT / Auth ──
    JWT_SECRET: str = "fleet-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # ── Istarmap API ──
    ISTARMAP_BASE_URL: str = "https://istarmap.com"
    ISTARMAP_CLIENT_ID: str = "third"
    ISTARMAP_CLIENT_SECRET: str = "89765423"
    ISTARMAP_USERNAME: str = ""
    ISTARMAP_PASSWORD: str = ""
    ISTARMAP_ORG_ID: int = 0

    # ── CORS ──
    CORS_ORIGINS: List[str] = ["*"]

    # ── AI Assistant (cloud providers, agnostic) ──
    # Provider: "ollama_cloud" | "deepseek" | "openai" | "openrouter"
    AI_PROVIDER: str = "ollama_cloud"
    AI_API_KEY: str = ""
    AI_MODEL: str = "qwen2.5:7b"
    AI_BASE_URL: str = "https://api.ollama.com/v1"
    AI_TEMPERATURE: float = 0.3
    AI_MAX_TOKENS: int = 2048


settings = Settings()