"""Autenticación del admin: contraseña scrypt, sesión JWT con CSRF y límite de intentos.

La configuración se lee siempre de `config.settings` en el momento de la
llamada (no se copia al importar) para que las recargas y pruebas la vean.
"""
import base64
import hashlib
import hmac
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request

from app import config

COOKIE_NAME = "admin_session"
CSRF_HEADER = "X-CSRF-Token"
SESSION_HOURS = 8
JWT_ALGORITHM = "HS256"

# Parámetros scrypt (stdlib)
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SALT_BYTES = 16


# --- contraseña ---

def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("ascii")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s.encode("ascii"))


def _scrypt(pw: str, salt: bytes, n: int, r: int, p: int, dklen: int) -> bytes:
    return hashlib.scrypt(
        pw.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=dklen, maxmem=64 * 1024 * 1024
    )


def hash_password(pw: str) -> str:
    """Devuelve `scrypt$16384$8$1$<sal>$<hash>` (base64 urlsafe)."""
    salt = secrets.token_bytes(SALT_BYTES)
    dk = _scrypt(pw, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, SCRYPT_DKLEN)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64e(salt)}${_b64e(dk)}"


def verify_password(pw: str, stored: str) -> bool:
    """Compara en tiempo constante; cualquier formato inválido cuenta como fallo."""
    try:
        alg, n, r, p, salt_b64, hash_b64 = (stored or "").split("$")
        if alg != "scrypt":
            return False
        esperado = _b64d(hash_b64)
        dk = _scrypt(pw, _b64d(salt_b64), int(n), int(r), int(p), len(esperado))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, esperado)


# --- sesión ---

def cross_site() -> bool:
    """Dominios distintos si CORS_ORIGINS tiene valor; vacío = mismo dominio."""
    return bool(config.settings.get_cors_origins_list)


def create_session(username: str) -> tuple[str, str]:
    """Crea el JWT de sesión. Devuelve (token, csrf)."""
    csrf = secrets.token_urlsafe(24)
    payload = {
        "sub": username,
        "csrf": csrf,
        "exp": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS),
    }
    token = jwt.encode(payload, config.settings.jwt_secret, algorithm=JWT_ALGORITHM)
    return token, csrf


def _claims(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        claims = jwt.decode(token, config.settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    admin = config.settings.admin_user
    if not admin or claims.get("sub") != admin:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    return claims


def require_admin(request: Request) -> str:
    """Dependencia: usuario de la sesión o 401."""
    return _claims(request)["sub"]


def require_csrf(request: Request, user: str = Depends(require_admin)) -> str:
    """Dependencia para operaciones que modifican.

    Dominios distintos: el header X-CSRF-Token es obligatorio y debe coincidir
    con el claim `csrf`. Mismo dominio: opcional, pero si viene debe coincidir.
    """
    enviado = request.headers.get(CSRF_HEADER)
    if enviado is None and not cross_site():
        return user
    esperado = _claims(request).get("csrf") or ""
    if not enviado or not esperado or not hmac.compare_digest(enviado, esperado):
        raise HTTPException(status_code=403, detail="Token CSRF inválido")
    return user


def cookie_kwargs() -> dict:
    """Parámetros de `response.set_cookie` para la sesión.

    SameSite=None exige Secure en los navegadores, así que en modo de
    dominios distintos la cookie siempre es Secure (localhost cuenta como
    contexto seguro).
    """
    cs = cross_site()
    return {
        "httponly": True,
        "max_age": SESSION_HOURS * 3600,
        "samesite": "none" if cs else "strict",
        "secure": cs or config.settings.environment != "local",
        "path": "/",
    }


# --- límite de intentos ---

class LoginLimiter:
    """Fallos de login por IP en una ventana deslizante (en memoria)."""

    def __init__(self, max_fails: int = 5, window_s: int = 900):
        self.max_fails = max_fails
        self.window_s = window_s
        self._fails: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, ahora: float) -> None:
        limite = ahora - self.window_s
        for ip in list(self._fails):
            vivos = [t for t in self._fails[ip] if t > limite]
            if vivos:
                self._fails[ip] = vivos
            else:
                del self._fails[ip]

    def check(self, ip: str) -> int | None:
        """Segundos que faltan para poder intentar de nuevo, o None si puede."""
        with self._lock:
            ahora = time.monotonic()
            self._prune(ahora)
            fallos = self._fails.get(ip, [])
            if len(fallos) < self.max_fails:
                return None
            # Se libera cuando el fallo que completa el límite sale de la ventana
            libera = fallos[-self.max_fails] + self.window_s
            return max(1, int(libera - ahora + 0.999))

    def fail(self, ip: str) -> None:
        with self._lock:
            ahora = time.monotonic()
            self._prune(ahora)
            self._fails.setdefault(ip, []).append(ahora)

    def reset(self, ip: str) -> None:
        with self._lock:
            self._fails.pop(ip, None)


login_limiter = LoginLimiter()


def client_ip(request) -> str:
    """IP del cliente; X-Forwarded-For (primer valor) solo con TRUST_PROXY."""
    if config.settings.trust_proxy:
        xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
        if xff:
            primera = xff.split(",")[0].strip()
            if primera:
                return primera
    cliente = getattr(request, "client", None)
    return getattr(cliente, "host", None) or "desconocida"


# --- compatibilidad con routes/admin.py previo (se elimina en Task 5) ---

def create_access_token(data: dict, expires_delta: timedelta = timedelta(hours=SESSION_HOURS)) -> str:
    token, _ = create_session(data["sub"])
    return token


get_current_admin = require_admin
