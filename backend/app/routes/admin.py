"""Endpoints del panel de administración de datos (`/api/admin`).

Capa delgada sobre `services.datastore.DataStore` y `services.auth`. El
router solo se registra si `main.ADMIN_ACTIVE` (ENABLE_ADMIN=true y config
segura); `main` le pasa el almacén con `init(store)`.
"""
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel

from app import config
from app.services import auth
from app.services.datastore import (
    BusyError, DataStore, NothingToDoError, ReloadError, TooLargeError, ValidationError,
)

# Margen para encabezados y límites del multipart sobre MAX_UPLOAD_MB
MARGEN_MULTIPART = 1024 * 1024


def _limite_bytes() -> int:
    return config.settings.max_upload_mb * 1024 * 1024


class RutaConLimite(APIRoute):
    """Rechaza con 413 por Content-Length antes de que FastAPI lea el cuerpo.

    Las dependencias corren después de parsear el multipart, así que la
    revisión temprana tiene que ir en la ruta misma.
    """

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def con_limite(request: Request):
            largo = request.headers.get("content-length")
            if largo is not None:
                try:
                    excede = int(largo) > _limite_bytes() + MARGEN_MULTIPART
                except ValueError:
                    return JSONResponse(status_code=400, content={"detail": "Content-Length inválido"})
                if excede:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": f"El archivo excede el límite de {config.settings.max_upload_mb} MB"},
                    )
            return await handler(request)

        return con_limite


router = APIRouter(prefix="/api/admin", tags=["admin"], route_class=RutaConLimite)

Conjunto = Literal["delitos", "victimas", "victimas_mun", "poblacion"]

_store: DataStore | None = None


def init(store: DataStore) -> None:
    global _store
    _store = store


def _almacen() -> DataStore:
    if _store is None:
        raise HTTPException(status_code=503, detail="Almacén de datos no disponible")
    return _store


class LoginRequest(BaseModel):
    username: str
    password: str


# ── Sesión ────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(credentials: LoginRequest, request: Request, response: Response):
    ip = auth.client_ip(request)
    espera = auth.login_limiter.check(ip)
    if espera is not None:
        minutos = max(1, -(-espera // 60))
        return JSONResponse(
            status_code=429,
            content={"detail": f"Demasiados intentos, espera {minutos} minutos", "retry_after": espera},
            headers={"Retry-After": str(espera)},
        )

    s = config.settings
    usuario_ok = bool(s.admin_user) and credentials.username == s.admin_user
    # Se verifica siempre para no revelar por tiempo si el usuario existe
    clave_ok = auth.verify_password(credentials.password, s.admin_password_hash)
    if not (usuario_ok and clave_ok):
        auth.login_limiter.fail(ip)
        if _store is not None:
            _store.log_event("login_fail", credentials.username[:64], ip=ip)
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    auth.login_limiter.reset(ip)
    token, csrf = auth.create_session(s.admin_user)
    response.set_cookie(key=auth.COOKIE_NAME, value=token, **auth.cookie_kwargs())
    return {"username": s.admin_user, "csrf_token": csrf}


@router.post("/logout")
def logout(response: Response):
    # Sin exigir sesión válida: una cookie vencida o de otro secreto también se borra
    kw = auth.cookie_kwargs()
    response.delete_cookie(
        auth.COOKIE_NAME, path=kw["path"], secure=kw["secure"], httponly=True, samesite=kw["samesite"]
    )
    return {"message": "Sesión finalizada"}


@router.get("/me")
def me(request: Request):
    claims = auth.session_claims(request)
    return {"username": claims["sub"], "csrf_token": claims.get("csrf")}


# ── Conjuntos ─────────────────────────────────────────────────────────────────
def _operar(fn, *args):
    """Ejecuta una operación del almacén y traduce sus errores a HTTP."""
    try:
        return fn(*args)
    except TooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusyError:
        raise HTTPException(status_code=409, detail="Operación en curso")
    except NothingToDoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ReloadError as e:
        print(f"[ADMIN] recarga fallida en {getattr(fn, '__name__', 'operación')}: {e}")
        raise HTTPException(
            status_code=500,
            detail="No se pudieron recargar los datos; se mantuvo la versión anterior",
        )
    except Exception as e:
        # El mensaje puede traer rutas del servidor: solo va al log
        print(f"[ADMIN] error en {getattr(fn, '__name__', 'operación')}: {e!r}")
        raise HTTPException(status_code=500, detail=f"Error de almacenamiento: {type(e).__name__}")


@router.get("/datasets")
def datasets(user: str = Depends(auth.require_admin)):
    return _almacen().status()


@router.post("/datasets/{c}/upload")
def upload(c: Conjunto, file: UploadFile = File(...), user: str = Depends(auth.require_csrf)):
    store = _almacen()
    max_bytes = _limite_bytes()
    # Content-Length ya se revisó antes de leer el cuerpo (RutaConLimite); aquí se
    # vuelve a contar al copiar por si no venía o mentía
    try:
        resultado = _operar(store.stage, c, file.file, max_bytes, user)
    finally:
        file.file.close()
    cambios = resultado.pop("diff")
    return {"staging": resultado, "diff": cambios}


@router.post("/datasets/{c}/publish")
def publish(c: Conjunto, user: str = Depends(auth.require_csrf)):
    return {"published": _operar(_almacen().publish, c, user)}


@router.post("/datasets/{c}/restore")
def restore(c: Conjunto, user: str = Depends(auth.require_csrf)):
    return {"published": _operar(_almacen().restore, c, user)}


@router.delete("/datasets/{c}/staging", status_code=204)
def discard(c: Conjunto, user: str = Depends(auth.require_csrf)):
    _operar(_almacen().discard, c, user)
    return Response(status_code=204)


@router.get("/log")
def log(limit: int = Query(50, ge=1, le=500), user: str = Depends(auth.require_admin)):
    return _almacen().log(limit)
