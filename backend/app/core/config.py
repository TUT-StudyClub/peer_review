from typing import TypedDict

from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Allow extra env vars (e.g., local-only secrets for scripts)
    )

    app_env: str = "dev"
    database_url: str = "sqlite:///./dev.db"

    # 起動時の自動マイグレーション実行を制御
    # 本番環境でDDL権限がない場合や手動管理が必要な場合はFalseに設定
    run_migrations_on_startup: bool = True

    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    allow_teacher_registration: bool = True

    storage_dir: str = "storage"
    storage_backend: str = "local"
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_key_prefix: str = "submissions"
    s3_use_path_style: bool = False

    # TA/credits
    ta_qualification_threshold: int = 20
    review_credit_base: float = 1.0
    review_credit_alignment_bonus_max: float = 1.0
    review_credit_rubric_weight: float = 0.5
    review_credit_comment_weight: float = 0.5
    ta_credit_multiplier: float = 2.0

    openai_api_key: str | None = None
    # 類似検知 (review similarity) の設定
    similarity_threshold: float = 0.5
    similarity_penalty_enabled: bool = True
    similarity_ngram_n: int = 2
    duplicate_penalty_rate: float = 0.4
    duplicate_quality_penalty_points: int = 1

    # OpenAI依存の機能を有効にするためのフラグ
    enable_openai: bool = False  # defaultでは無効

    # Comma-separated origins for browser-based frontends (e.g. "http://localhost:3000,http://127.0.0.1:3000")
    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex-based origins (useful when Next.js dev port changes, e.g. 3001/3002).
    # Example: ^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$
    cors_allow_origin_regex: str | None = r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$"

    # Web Push通知設定
    vapid_private_key: str = ""  # VAPID private key for web push
    vapid_public_key: str = ""  # VAPID public key for web push
    vapid_subject: str = "mailto:admin@example.com"  # VAPID subject (email)


settings = Settings()


class ReviewerSkillTemplateItem(TypedDict):
    key: str
    label: str
    name: str
    description: str
    max_score: int
    order_index: int


# ユーザーランク（クレジット）
USER_RANK_DEFINITIONS = [
    {"key": "novice", "min_credits": 0, "title": "見習いレビュアー"},
    {"key": "bronze", "min_credits": 5, "title": "ブロンズレビュアー"},
    {"key": "silver", "min_credits": 15, "title": "シルバーレビュアー"},
    {"key": "gold", "min_credits": 30, "title": "ゴールドレビュアー"},
    {"key": "platinum", "min_credits": 50, "title": "プラチナレビュアー"},
    {"key": "diamond", "min_credits": 80, "title": "ダイヤモンドレビュアー"},
]

REVIEWER_SKILL_TEMPLATE: list[ReviewerSkillTemplateItem] = [
    {
        "key": "logic",
        "label": "論理性",
        "name": "論理性",
        "description": "主張と根拠のつながりが明確か",
        "max_score": 5,
        "order_index": 0,
    },
    {
        "key": "specificity",
        "label": "具体性",
        "name": "具体性",
        "description": "具体例や数値が示されているか",
        "max_score": 5,
        "order_index": 1,
    },
    {
        "key": "structure",
        "label": "構成",
        "name": "構成",
        "description": "構成や流れが分かりやすいか",
        "max_score": 5,
        "order_index": 2,
    },
    {
        "key": "evidence",
        "label": "根拠",
        "name": "根拠",
        "description": "根拠や引用が妥当か",
        "max_score": 5,
        "order_index": 3,
    },
]

REVIEWER_SKILL_AXES = [{"key": item["key"], "label": item["label"]} for item in REVIEWER_SKILL_TEMPLATE]

COURSE_TITLE_CANDIDATES = [
    "プログラミング基礎",
    "データ構造とアルゴリズム",
    "離散数学",
    "計算機アーキテクチャ",
    "オペレーティングシステム",
    "データベースシステム",
    "コンピュータネットワーク",
    "ソフトウェア工学",
    "情報セキュリティ基礎",
    "機械学習入門",
]
