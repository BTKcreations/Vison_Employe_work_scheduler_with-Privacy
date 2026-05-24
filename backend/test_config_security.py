import pytest

from app.config import Settings


def test_production_config_rejects_weak_secret_and_wildcard_cors():
    with pytest.raises(ValueError):
        Settings(APP_ENV="production", JWT_SECRET="change-this-secret", CORS_ORIGINS="https://example.com")

    with pytest.raises(ValueError):
        Settings(APP_ENV="production", JWT_SECRET="x" * 32, CORS_ORIGINS="*")


def test_production_config_accepts_strong_secret_and_explicit_cors():
    settings = Settings(
        APP_ENV="production",
        JWT_SECRET="x" * 32,
        CORS_ORIGINS="https://app.example.com,https://admin.example.com",
    )

    assert settings.cors_origins_list == ["https://app.example.com", "https://admin.example.com"]
