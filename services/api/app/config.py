from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
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
    # Urgent-attention symptom codes for the symptom-report pathway (Phase 2).
    # Default set follows the screening questionnaire's own danger-signal list
    # (red flags already used by the clinical assessment flow); configurable so
    # an approved clinical protocol can override it without code changes.
    # IMPORTANT: enable in production only after clinical sign-off (PRD DEC-13
    # territory must remain untouched — no invented clinical thresholds).
    urgent_symptom_codes: str = Field(
        default="breathing_difficulty,chest_pain,confusion",
        validation_alias=AliasChoices("urgent_symptom_codes", "m3_urgent_symptom_codes")
    )

    @property
    def urgent_symptoms(self) -> set[str]:
        return {x.strip() for x in self.urgent_symptom_codes.split(",") if x.strip()}

    @property
    def cors_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
