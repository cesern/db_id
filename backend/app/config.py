from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Sin valores por defecto: si faltan, el admin no se registra (ver admin_config_problems)
    admin_user: str = ""
    # Hash scrypt generado con `python -m app.tools.hash_password`
    admin_password_hash: str = ""
    jwt_secret: str = ""
    # OBSOLETO: el algoritmo está fijo en HS256 (auth.JWT_ALGORITHM); se ignora.
    jwt_algorithm: str = "HS256"
    environment: str = "local"
    # Interruptor del admin: apagado salvo ENABLE_ADMIN=true
    enable_admin: bool = False
    # Tomar la IP de X-Forwarded-For (solo detrás de un proxy de confianza)
    trust_proxy: bool = False
    # Proxies de confianza delante del backend: la IP real es el valor en la
    # posición -N desde la derecha de X-Forwarded-For (los primeros son falsificables)
    trusted_proxy_hops: int = 1

    # Compatibilidad: si PARQUET_DIR está definida, es la carpeta de publicados
    parquet_dir: str = str(BASE_DIR / "storage" / "parquet")

    # Almacén del admin de datos (publicados, en espera, respaldo, bitácora)
    data_store_dir: str = str(BASE_DIR / "storage")
    data_store_persistent: bool = False
    max_upload_mb: int = 100

    @field_validator("*", mode="before")
    @classmethod
    def _vacio_es_default(cls, v, info: ValidationInfo):
        # Una variable vacía (p. ej. en Railway) no debe impedir el arranque:
        # en los campos que no son texto cuenta como su valor por defecto.
        campo = cls.model_fields[info.field_name]
        if campo.annotation is not str and isinstance(v, str) and not v.strip():
            return campo.default
        return v

    @property
    def get_cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def published_dir(self) -> str:
        """Carpeta de publicados: PARQUET_DIR si se definió; si no, `<DATA_STORE_DIR>/parquet`."""
        if "parquet_dir" in self.model_fields_set and self.parquet_dir.strip():
            return self.parquet_dir
        return str(Path(self.data_store_dir) / "parquet")

    @property
    def store_persistent(self) -> bool:
        """Persistente si DATA_STORE_PERSISTENT=true o el almacén está fuera de la app."""
        if self.data_store_persistent:
            return True
        return not Path(self.data_store_dir).resolve().is_relative_to(BASE_DIR.resolve())

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

# Secretos de ejemplo conocidos que nunca deben usarse
SECRETOS_DE_EJEMPLO = {"secret", "super_secret_key", "change_me"}


def admin_config_problems(s: Settings) -> list[str]:
    """Motivos por los que la config del admin no es segura (vacío = segura).

    CORS_ORIGINS vacío es válido: es el modo de mismo dominio.
    """
    problemas: list[str] = []
    if not s.admin_user.strip():
        problemas.append("falta ADMIN_USER")
    h = s.admin_password_hash
    if not h.startswith("scrypt$"):
        problemas.append(
            "falta ADMIN_PASSWORD_HASH (formato scrypt$...; generar con python -m app.tools.hash_password)"
        )
    else:
        partes = h.split("$")
        try:
            n_ok = len(partes) == 6 and int(partes[1]) >= 2**14
        except ValueError:
            n_ok = False
        if not n_ok:
            problemas.append(
                "ADMIN_PASSWORD_HASH mal formado o con parámetro n menor a 16384 "
                "(regenerar con python -m app.tools.hash_password)"
            )
    if s.jwt_secret in SECRETOS_DE_EJEMPLO:
        problemas.append("JWT_SECRET es un valor de ejemplo")
    elif len(s.jwt_secret) < 32:
        problemas.append("JWT_SECRET debe tener al menos 32 caracteres")
    if "*" in s.get_cors_origins_list:
        problemas.append("CORS_ORIGINS no puede contener '*' con el admin (usar la lista exacta de orígenes)")
    return problemas


settings = Settings()
