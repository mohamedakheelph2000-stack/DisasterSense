"""
Application configuration.

All settings are loaded from environment variables.
Copy backend/.env.example to backend/.env and fill in real values locally.
Never commit real secrets.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central settings object.

    pydantic-settings automatically reads values from environment variables
    (case-insensitive) and from a .env file when present.
    """

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "DisasterSense API"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = True

    # ── API ───────────────────────────────────────────────────────────────────
    API_V1_PREFIX: str = "/api/v1"

    # ── Clustering ────────────────────────────────────────────────────────────
    CLUSTER_SPATIAL_THRESHOLD_KM: float = 10.0
    CLUSTER_TEMPORAL_THRESHOLD_HOURS: float = 24.0

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins; adjust for production.
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── Database ──────────────────────────────────────────────────────────────
    # Full PostgreSQL connection URL.
    DATABASE_URL: str = "postgresql://disastersense:changeme@localhost:5432/disastersense"

    # ── Security ──────────────────────────────────────────────────────────────
    # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "REPLACE_ME_WITH_A_REAL_SECRET_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS_ORIGINS as a Python list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Module-level singleton — import this everywhere.
settings = Settings()
