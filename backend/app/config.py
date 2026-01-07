from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # AI Provider API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    mistral_api_key: str = ""
    cohere_api_key: str = ""

    # AI Model Configurations
    openai_model: str = "gpt-4-turbo-preview"
    anthropic_model: str = "claude-3-sonnet-20240229"
    mistral_model: str = "mistral-large-latest"
    cohere_model: str = "command-r-plus"

    # Pinecone Configuration
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1"
    pinecone_index_name: str = "qodex-documents"

    # Application Configuration
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    debug: bool = True
    log_level: str = "INFO"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
