from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "PCBMind AI"
    ENV: str = "development"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # Database (direct Postgres connection, used by SQLAlchemy)
    DATABASE_URL: str

    # Storage
    STORAGE_BUCKET: str = "pcb-images"

    # AI
    MODEL_WEIGHTS_PATH: str = "app/services/weights/pcb_defect_yolo.pt"
    INFERENCE_CONFIDENCE_THRESHOLD: float = 0.35
    MAX_UPLOAD_MB: int = 10

    # AI — LLM report generation (via OpenRouter, OpenAI-compatible API)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-haiku-4.5"
    # A stronger tier than the one-shot summary model above — the copilot's
    # tool-selection/synthesis quality across a multi-turn conversation
    # matters more than the cost/latency Haiku is optimized for.
    OPENROUTER_COPILOT_MODEL: str = "anthropic/claude-sonnet-4.5"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
