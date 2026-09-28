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


@pytest.fixture
def make_client(monkeypatch):
    """Devuelve `make_client(env) -> TestClient` con el entorno dado.

    ENABLE_ADMIN siempre se fija o se borra explícitamente para no heredar
    el valor de la terminal.
    """
    monkeypatch.chdir(BACKEND_DIR)

    def _make(env: dict) -> TestClient:
        if "ENABLE_ADMIN" not in env:
            monkeypatch.delenv("ENABLE_ADMIN", raising=False)
        for clave, valor in env.items():
            monkeypatch.setenv(clave, str(valor))
        for nombre in MODULOS:
            modulo = sys.modules.get(nombre) or importlib.import_module(nombre)
            importlib.reload(modulo)
        return TestClient(sys.modules["app.main"].app)

    return _make
