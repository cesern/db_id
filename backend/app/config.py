from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Sin valores por defecto: si faltan, el admin no se registra (ver admin_config_problems)
    admin_user: str = ""
    # OBSOLETO: contraseña en texto plano; solo la usa routes/admin.py hasta Task 5.
    admin_password: str = ""
    # Hash scrypt generado con `python -m app.tools.hash_password`
    admin_password_hash: str = ""
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    environment: str = "local"
    # Interruptor del admin: apagado salvo ENABLE_ADMIN=true
    enable_admin: bool = False
    # Tomar la IP de X-Forwarded-For (solo detrás de un proxy de confianza)
    trust_proxy: bool = False

    @field_validator("enable_admin", "trust_proxy", mode="before")
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

# Secretos de ejemplo conocidos que nunca deben usarse
SECRETOS_DE_EJEMPLO = {"secret", "super_secret_key", "change_me"}


def admin_config_problems(s: Settings) -> list[str]:
    """Motivos por los que la config del admin no es segura (vacío = segura).

    CORS_ORIGINS vacío es válido: es el modo de mismo dominio.
    """
    problemas: list[str] = []
    if not s.admin_user.strip():
        problemas.append("falta ADMIN_USER")
    if not s.admin_password_hash.startswith("scrypt$"):
        problemas.append(
            "falta ADMIN_PASSWORD_HASH (formato scrypt$...; generar con python -m app.tools.hash_password)"
        )
    if s.jwt_secret in SECRETOS_DE_EJEMPLO:
        problemas.append("JWT_SECRET es un valor de ejemplo")
    elif len(s.jwt_secret) < 32:
        problemas.append("JWT_SECRET debe tener al menos 32 caracteres")
    if "*" in s.get_cors_origins_list:
        problemas.append("CORS_ORIGINS no puede contener '*' con el admin (usar la lista exacta de orígenes)")
    return problemas


settings = Settings()
