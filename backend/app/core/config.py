from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Allow extra env vars (e.g., local-only secrets for scripts)
    )

    app_env: str = "dev"
    database_url: str = "sqlite:///./dev.db"

    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    allow_teacher_registration: bool = True

    storage_dir: str = "storage"

    # TA/credits
    ta_qualification_threshold: int = 20
    review_credit_base: float = 1.0
    review_credit_alignment_bonus_max: float = 1.0
    ta_credit_multiplier: float = 2.0

    openai_api_key: str | None = None
    # 類似検知 (review similarity) の設定
    similarity_threshold: float = 0.5
    similarity_penalty_enabled: bool = True
    similarity_ngram_n: int = 2

    # OpenAI依存の機能を有効にするためのフラグ
    enable_openai: bool = False #defaultでは無効

    # Comma-separated origins for browser-based frontends (e.g. "http://localhost:3000,http://127.0.0.1:3000")
    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex-based origins (useful when Next.js dev port changes, e.g. 3001/3002).
    # Example: ^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$
    cors_allow_origin_regex: str | None = r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$"


settings = Settings()
