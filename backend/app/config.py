from pydantic import field_validator
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
    # Interruptor del admin: apagado salvo ENABLE_ADMIN=true
    enable_admin: bool = False

    @field_validator("enable_admin", mode="before")
    @classmethod
    def _enable_admin_vacio(cls, v):
        # Una variable vacía (p. ej. en Railway) no debe impedir el arranque: cuenta como apagado
        return False if isinstance(v, str) and not v.strip() else v
    
    # Rutas por defecto
    uploads_dir: str = str(BASE_DIR / "storage" / "uploads")
    parquet_dir: str = str(BASE_DIR / "storage" / "parquet")
    data_dir: str = str(BASE_DIR / "data")

    # Almacén del admin de datos (publicados, en espera, respaldo, bitácora)
    data_store_dir: str = str(BASE_DIR / "storage")
    data_store_persistent: bool = False
    max_upload_mb: int = 100

    @field_validator("data_store_persistent", mode="before")
    @classmethod
    def _persistente_vacio(cls, v):
        # Igual que ENABLE_ADMIN: vacío cuenta como False
        return False if isinstance(v, str) and not v.strip() else v
    
    @property
    def get_cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
