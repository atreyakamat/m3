from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./m3-dev.db"
    jwt_secret: str = "development-only-change-before-deployment"
    bootstrap_secret: str = "development-bootstrap-change-before-deployment"
    access_token_minutes: int = 30
    cors_origins: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("cors_origins", "api_cors_origins")
    )
    failed_login_limit: int = 5
    lockout_minutes: int = 15

    @property
    def cors_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
