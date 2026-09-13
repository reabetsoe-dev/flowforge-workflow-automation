from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite:///./flowforge.db"
    turso_database_url: str | None = None
    turso_auth_token: str | None = None
    vercel: str | None = None
    jwt_secret_key: str = "replace-with-secure-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.frontend_url]
        origins.extend(
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        )
        return list(dict.fromkeys(origins))

    @property
    def running_on_vercel(self) -> bool:
        return self.vercel == "1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
