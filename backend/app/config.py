from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    admin_user: str = "admin"
    admin_password: str = "admin"
    jwt_secret: str = "secret"
    jwt_algorithm: str = "HS256"
    environment: str = "local"
    
    # Rutas por defecto
    uploads_dir: str = str(BASE_DIR / "storage" / "uploads")
    parquet_dir: str = str(BASE_DIR / "storage" / "parquet")
    data_dir: str = str(BASE_DIR / "data")
    
    @property
    def get_cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
