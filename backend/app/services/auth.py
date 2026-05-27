import jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, Security, Request
from fastapi.security import APIKeyCookie
from app.config import settings

# Usar cookie de autorización en lugar de Bearer en header (más seguro contra XSS)
cookie_scheme = APIKeyCookie(name="admin_session", auto_error=False)

def create_access_token(data: dict, expires_delta: timedelta = timedelta(hours=8)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def get_current_admin(token: str = Security(cookie_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("sub")
        if username is None or username != settings.admin_user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
