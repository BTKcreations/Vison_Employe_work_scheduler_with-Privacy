"""
Application configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List


class Settings(BaseSettings):
    APP_ENV: str = "development"
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "employee_task_reward"
    JWT_SECRET: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.APP_ENV.lower() in {"production", "prod"}:
            if self.JWT_SECRET == "change-this-secret" or len(self.JWT_SECRET.strip()) < 32:
                raise ValueError("Production APP_ENV requires a strong JWT_SECRET of at least 32 characters.")
            if "*" in self.cors_origins_list:
                raise ValueError("Production APP_ENV requires explicit CORS_ORIGINS; wildcard '*' is not allowed.")
        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
