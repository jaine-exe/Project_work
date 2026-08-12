import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "GST Lite API"
    ENV: str = "development"

    # Database — SQLite for local dev, swap DATABASE_URL for Postgres in prod
    DATABASE_URL: str = "sqlite:///./gstlite.db"

    # Auth
    SECRET_KEY: str = "dev-secret-change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # File storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 15

    # Optional external services
    OPENAI_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None  # Added Groq API Key support
    OCR_PROVIDER: str = "mock"  # "mock" | "tesseract" | "paddleocr"

    # CORS — the Next.js frontend origin(s)
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Prevents crashes from unmapped .env variables
    )


settings = Settings()