from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AutoRAG EvalOps"
    API_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"

    FRONTEND_URL: str = "http://localhost:3000"

    DATABASE_URL: str = ""

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_REWRITE_MODEL: str = "gemini-2.0-flash"
    ENABLE_LLM_QUERY_REWRITE: bool = True
    CI_GATE_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()