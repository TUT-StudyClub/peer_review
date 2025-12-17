from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "dev"
    database_url: str = "sqlite:///./dev.db"

    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    allow_teacher_registration: bool = True

    storage_dir: str = "storage"

    openai_api_key: str | None = None

    # Comma-separated origins for browser-based frontends (e.g. "http://localhost:3000,http://127.0.0.1:3000")
    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"


settings = Settings()
