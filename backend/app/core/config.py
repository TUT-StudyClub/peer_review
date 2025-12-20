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

    # OpenAI依存の機能を有効にするためのフラグ
    enable_openai: bool = False #defaultでは無効

    # Comma-separated origins for browser-based frontends (e.g. "http://localhost:3000,http://127.0.0.1:3000")
    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex-based origins (useful when Next.js dev port changes, e.g. 3001/3002).
    # Example: ^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$
    cors_allow_origin_regex: str | None = r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$"


settings = Settings()
