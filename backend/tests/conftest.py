"""Fixtures compartidas de pruebas del backend.

`app.main` arma el estado global (DuckDB, caches, middleware, routers) al
importarse, así que cada cliente recarga los módulos con el entorno pedido.
"""
import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Orden de recarga: config primero; main al final porque importa a los demás
MODULOS = ["app.config", "app.services.auth", "app.routes.admin", "app.main"]

# Variables que el cliente nunca hereda del entorno si la prueba no las fija
HEREDABLES = [
    "ENABLE_ADMIN", "ADMIN_USER", "ADMIN_PASSWORD_HASH", "JWT_SECRET", "CORS_ORIGINS",
    "PARQUET_DIR", "DATA_STORE_DIR", "DATA_STORE_PERSISTENT", "MAX_UPLOAD_MB",
    "TRUST_PROXY", "TRUSTED_PROXY_HOPS", "ENVIRONMENT",
]


@pytest.fixture
def make_client(monkeypatch):
    """Devuelve `make_client(env) -> TestClient` con el entorno dado.

    Las variables del admin y del almacén que no vengan en `env` se borran
    para no heredar las de la terminal. `https=True` usa https://testserver
    (necesario para que el cliente mande cookies `Secure`).
    """
    monkeypatch.chdir(BACKEND_DIR)

    def _make(env: dict, https: bool = False) -> TestClient:
        for clave in HEREDABLES:
            if clave not in env:
                monkeypatch.delenv(clave, raising=False)
        for clave, valor in env.items():
            monkeypatch.setenv(clave, str(valor))
        for nombre in MODULOS:
            modulo = sys.modules.get(nombre) or importlib.import_module(nombre)
            importlib.reload(modulo)
        base = "https://testserver" if https else "http://testserver"
        return TestClient(sys.modules["app.main"].app, base_url=base)

    return _make
