"""Autenticación del admin: scrypt, sesión JWT con CSRF y límite de intentos."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import config
from app.services import auth

SECRETO = "s" * 40


@pytest.fixture
def cfg(monkeypatch):
    """Configuración de admin segura sobre el `settings` vigente."""
    s = config.settings
    monkeypatch.setattr(s, "admin_user", "admin")
    monkeypatch.setattr(s, "admin_password_hash", auth.hash_password("clave-de-prueba"))
    monkeypatch.setattr(s, "jwt_secret", SECRETO)
    monkeypatch.setattr(s, "jwt_algorithm", "HS256")
    monkeypatch.setattr(s, "environment", "local")
    monkeypatch.setattr(s, "cors_origins", "")
    monkeypatch.setattr(s, "trust_proxy", False)
    return s


@pytest.fixture
def client(cfg):
    app = FastAPI()

    @app.get("/me")
    def me(user: str = Depends(auth.require_admin)):
        return {"user": user}

    @app.post("/mut")
    def mut(user: str = Depends(auth.require_csrf)):
        return {"user": user}

    return TestClient(app)


def _con_sesion(client, token):
    client.cookies.set("admin_session", token)
    return client


# --- contraseña ---

def test_hash_roundtrip():
    h = auth.hash_password("clave-de-prueba")
    assert h.startswith("scrypt$16384$8$1$")
    assert len(h.split("$")) == 6
    assert auth.verify_password("clave-de-prueba", h)
    assert not auth.verify_password("otra", h)
    # Sal distinta en cada hash
    assert auth.hash_password("clave-de-prueba") != h


def test_verify_rejects_malformed():
    assert not auth.verify_password("x", "")
    assert not auth.verify_password("x", "scrypt$abc")
    assert not auth.verify_password("x", "bcrypt$1$2$3$4$5")


# --- configuración ---

def test_config_problems(cfg):
    assert config.admin_config_problems(cfg) == []

    sin_hash = cfg.model_copy(update={"admin_password_hash": ""})
    assert config.admin_config_problems(sin_hash)

    corto = cfg.model_copy(update={"jwt_secret": "a" * 10})
    assert config.admin_config_problems(corto)

    ejemplo = cfg.model_copy(update={"jwt_secret": "secret"})
    assert config.admin_config_problems(ejemplo)

    sin_usuario = cfg.model_copy(update={"admin_user": ""})
    assert config.admin_config_problems(sin_usuario)

    comodin = cfg.model_copy(update={"cors_origins": "*"})
    assert config.admin_config_problems(comodin)

    # Mismo dominio (CORS vacío) con admin encendido es válido
    mismo = cfg.model_copy(update={"enable_admin": True, "cors_origins": ""})
    assert config.admin_config_problems(mismo) == []


def test_new_settings_empty_means_false(monkeypatch):
    monkeypatch.setenv("TRUST_PROXY", "")
    assert config.Settings().trust_proxy is False


# --- límite de intentos ---

def test_limiter_blocks_after_5():
    lim = auth.LoginLimiter(max_fails=5, window_s=900)
    for _ in range(4):
        lim.fail("1.2.3.4")
    assert lim.check("1.2.3.4") is None
    lim.fail("1.2.3.4")
    espera = lim.check("1.2.3.4")
    assert espera is not None and espera > 0
    assert lim.check("5.6.7.8") is None
    lim.reset("1.2.3.4")
    assert lim.check("1.2.3.4") is None


def test_limiter_window_expires(monkeypatch):
    ahora = [1000.0]
    monkeypatch.setattr(auth.time, "monotonic", lambda: ahora[0])
    lim = auth.LoginLimiter(max_fails=5, window_s=900)
    for _ in range(5):
        lim.fail("ip")
    assert lim.check("ip") > 0
    ahora[0] += 901
    assert lim.check("ip") is None


def test_client_ip_trust_proxy(cfg, monkeypatch):
    class Req:
        headers = {"x-forwarded-for": "9.9.9.9, 10.0.0.1"}

        class client:
            host = "10.0.0.1"

    assert auth.client_ip(Req) == "10.0.0.1"
    monkeypatch.setattr(cfg, "trust_proxy", True)
    assert auth.client_ip(Req) == "9.9.9.9"


# --- sesión ---

def test_session_ok(client):
    token, csrf = auth.create_session("admin")
    claims = jwt.decode(token, SECRETO, algorithms=["HS256"])
    assert claims["sub"] == "admin" and claims["csrf"] == csrf
    r = _con_sesion(client, token).get("/me")
    assert r.status_code == 200 and r.json() == {"user": "admin"}


def test_missing_cookie_401(client):
    assert client.get("/me").status_code == 401


def test_token_from_other_secret_rejected(client):
    otro = jwt.encode(
        {"sub": "admin", "csrf": "x", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "o" * 40,
        algorithm="HS256",
    )
    r = _con_sesion(client, otro).get("/me")
    assert r.status_code == 401


def test_expired_token_401(client):
    viejo = jwt.encode(
        {"sub": "admin", "csrf": "x", "exp": datetime.now(timezone.utc) - timedelta(seconds=5)},
        SECRETO,
        algorithm="HS256",
    )
    assert _con_sesion(client, viejo).get("/me").status_code == 401


def test_other_user_401(client, cfg, monkeypatch):
    token, _ = auth.create_session("admin")
    monkeypatch.setattr(cfg, "admin_user", "otro")
    assert _con_sesion(client, token).get("/me").status_code == 401


def test_csrf_required_cross_site(client, cfg, monkeypatch):
    monkeypatch.setattr(cfg, "cors_origins", "http://localhost:5173")
    assert auth.cross_site() is True
    token, csrf = auth.create_session("admin")
    c = _con_sesion(client, token)
    assert c.post("/mut").status_code == 403
    r = c.post("/mut", headers={"X-CSRF-Token": "otro"})
    assert r.status_code == 403 and r.json()["detail"] == "Token CSRF inválido"
    assert c.post("/mut", headers={"X-CSRF-Token": csrf}).status_code == 200


def test_csrf_optional_same_site(client, cfg):
    assert auth.cross_site() is False
    token, csrf = auth.create_session("admin")
    c = _con_sesion(client, token)
    assert c.post("/mut").status_code == 200
    assert c.post("/mut", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert c.post("/mut", headers={"X-CSRF-Token": "otro"}).status_code == 403


def test_mutation_without_session_401(client):
    assert client.post("/mut").status_code == 401


def test_cookie_kwargs(cfg, monkeypatch):
    k = auth.cookie_kwargs()
    assert k["httponly"] is True and k["max_age"] == 8 * 3600
    assert k["samesite"] == "strict" and k["secure"] is False

    monkeypatch.setattr(cfg, "environment", "production")
    assert auth.cookie_kwargs()["secure"] is True

    monkeypatch.setattr(cfg, "cors_origins", "https://front.example")
    k = auth.cookie_kwargs()
    assert k["samesite"] == "none" and k["secure"] is True
