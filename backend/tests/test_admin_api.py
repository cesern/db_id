"""Endpoints del admin (`/api/admin`) sobre un almacén temporal."""
import sys

import pytest

from app.schemas_datos import DATASETS, MESES
from app.services.auth import hash_password
from test_datastore import a_bytes, df_poblacion, df_serie

CLAVE = "clave-de-prueba"
HASH = hash_password(CLAVE)
SECRETO = "k" * 40
ORIGEN = "http://localhost:5173"
PERIODOS_2026 = [(2026, m) for m in MESES[:8]]


def _sembrar(store_dir):
    """Publicados mínimos en `<store>/parquet` (así no se copia el Parquet grande del repo)."""
    pub = store_dir / "parquet"
    pub.mkdir(parents=True)
    for c in ("delitos", "victimas", "victimas_mun"):
        df_serie(c, PERIODOS_2026, valor=5).to_parquet(pub / DATASETS[c]["file"], index=False)
    df_poblacion().to_parquet(pub / DATASETS["poblacion"]["file"], index=False)
    return pub


def _env(tmp_path, **extra):
    return {
        "ENABLE_ADMIN": "true",
        "ADMIN_USER": "admin",
        "ADMIN_PASSWORD_HASH": HASH,
        "JWT_SECRET": SECRETO,
        "DATA_STORE_DIR": str(tmp_path),
        "CORS_ORIGINS": ORIGEN,
        **extra,
    }


@pytest.fixture
def admin(make_client, tmp_path):
    """Cliente con admin encendido (dominios distintos) y almacén sembrado."""
    pub = _sembrar(tmp_path)
    c = make_client(_env(tmp_path), https=True)
    return c, pub


def _login(c):
    r = c.post("/api/admin/login", json={"username": "admin", "password": CLAVE})
    assert r.status_code == 200, r.text
    return {"X-CSRF-Token": r.json()["csrf_token"]}


def _subir(c, h, dataset="delitos", df=None):
    df = df_serie(dataset, PERIODOS_2026, valor=10) if df is None else df
    return c.post(f"/api/admin/datasets/{dataset}/upload", headers=h,
                  files={"file": ("cualquiera.parquet", a_bytes(df), "application/octet-stream")})


def _total(c):
    return c.get("/api/total_incidencia", params={"anio": 2026}).json()["total_incidencia"]


def test_unsafe_config_keeps_admin_off(make_client, tmp_path, capsys):
    _sembrar(tmp_path)
    c = make_client(_env(tmp_path, JWT_SECRET="corto"))
    assert c.post("/api/admin/login", json={"username": "admin", "password": CLAVE}).status_code == 404
    assert "[ADMIN] deshabilitado: JWT_SECRET" in capsys.readouterr().out


def test_admin_off_is_silent(make_client, capsys):
    make_client({})
    assert "[ADMIN]" not in capsys.readouterr().out


def test_login_ok_returns_csrf_and_cookie(admin, capsys):
    c, _ = admin
    r = c.post("/api/admin/login", json={"username": "admin", "password": CLAVE})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["username"] == "admin" and cuerpo["csrf_token"]
    cookie = r.headers["set-cookie"].lower()
    assert "admin_session=" in cookie and "httponly" in cookie and "samesite=none" in cookie and "secure" in cookie
    me = c.get("/api/admin/me").json()
    assert me == {"username": "admin", "csrf_token": cuerpo["csrf_token"]}


def test_login_bad_401(admin):
    c, _ = admin
    r = c.post("/api/admin/login", json={"username": "admin", "password": "otra"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Usuario o contraseña incorrectos"
    assert c.get("/api/admin/me").status_code == 401


def test_sixth_failed_login_429(admin):
    c, _ = admin
    for _ in range(5):
        assert c.post("/api/admin/login", json={"username": "x", "password": "y"}).status_code == 401
    r = c.post("/api/admin/login", json={"username": "admin", "password": CLAVE})
    assert r.status_code == 429
    cuerpo = r.json()
    assert cuerpo["retry_after"] > 0 and "Demasiados intentos, espera" in cuerpo["detail"]


def test_full_cycle(admin):
    c, _ = admin
    h = _login(c)
    antes = _total(c)
    assert antes == 8 * 5

    r = _subir(c, h)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["staging"]["total_last_year"] == 80 and "diff" not in cuerpo["staging"]
    assert cuerpo["diff"]["total_last_year"] == {"before": 40, "after": 80}

    st = c.get("/api/admin/datasets").json()
    assert st["persistent"] is True  # tmp_path está fuera de la app
    assert st["datasets"]["delitos"]["staging"]["rows"] == 8
    assert st["datasets"]["delitos"]["has_backup"] is False

    r = c.post("/api/admin/datasets/delitos/publish", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["published"]["total_last_year"] == 80
    assert _total(c) == 80
    st = c.get("/api/admin/datasets").json()["datasets"]["delitos"]
    assert st["staging"] is None and st["has_backup"] is True

    r = c.post("/api/admin/datasets/delitos/restore", headers=h)
    assert r.status_code == 200, r.text
    assert _total(c) == antes

    acciones = [e["action"] for e in c.get("/api/admin/log").json()]
    assert acciones[:3] == ["restore", "publish", "upload"]


def test_upload_invalid_400_and_discard(admin):
    c, _ = admin
    h = _login(c)
    r = _subir(c, h, "delitos", df_serie("victimas", PERIODOS_2026))
    assert r.status_code == 400 and "Faltan columnas" in r.json()["detail"]
    r = c.post("/api/admin/datasets/delitos/upload", headers=h,
               files={"file": ("x.parquet", b"no es parquet", "application/octet-stream")})
    assert r.status_code == 400
    assert _subir(c, h).status_code == 200
    assert c.delete("/api/admin/datasets/delitos/staging", headers=h).status_code == 204
    assert c.delete("/api/admin/datasets/delitos/staging", headers=h).status_code == 409


def test_upload_too_large_413(make_client, tmp_path):
    _sembrar(tmp_path)
    c = make_client(_env(tmp_path, MAX_UPLOAD_MB="0"), https=True)
    h = _login(c)
    assert _subir(c, h).status_code == 413


def test_publish_without_staging_409(admin):
    c, pub = admin
    h = _login(c)
    original = (pub / "delitos.parquet").read_bytes()
    r = c.post("/api/admin/datasets/delitos/publish", headers=h)
    assert r.status_code == 409 and r.json()["detail"] == "No hay archivo en espera"
    assert (pub / "delitos.parquet").read_bytes() == original


def test_restore_without_backup_409(admin):
    c, pub = admin
    h = _login(c)
    original = (pub / "victimas.parquet").read_bytes()
    r = c.post("/api/admin/datasets/victimas/restore", headers=h)
    assert r.status_code == 409 and "No hay versión anterior" in r.json()["detail"]
    assert (pub / "victimas.parquet").read_bytes() == original


def test_reload_error_500_keeps_published(admin):
    c, pub = admin
    h = _login(c)
    original = (pub / "delitos.parquet").read_bytes()
    assert _subir(c, h).status_code == 200

    def falla():
        raise RuntimeError("recarga rota")

    sys.modules["app.routes.admin"]._store.reload = falla
    r = c.post("/api/admin/datasets/delitos/publish", headers=h)
    assert r.status_code == 500
    assert "versión publicada anterior" in r.json()["detail"]
    assert (pub / "delitos.parquet").read_bytes() == original
    assert _total(c) == 40


def test_mutations_need_csrf(admin):
    c, _ = admin
    _login(c)
    assert _subir(c, {}).status_code == 403
    assert _subir(c, {"X-CSRF-Token": "falso"}).status_code == 403


def test_reads_need_session(admin):
    c, _ = admin
    assert c.get("/api/admin/datasets").status_code == 401
    assert c.get("/api/admin/log").status_code == 401


def test_unknown_dataset_422(admin):
    c, _ = admin
    h = _login(c)
    assert c.post("/api/admin/datasets/otros/publish", headers=h).status_code == 422


def test_old_endpoints_gone(admin):
    c, _ = admin
    _login(c)
    for ruta in ("/api/admin/run-etl", "/api/admin/upload", "/api/admin/reload-db"):
        assert c.post(ruta).status_code == 404
    assert c.get("/api/admin/etl-status").status_code == 404


def test_cors_modes(make_client, tmp_path):
    _sembrar(tmp_path)
    cruzado = make_client(_env(tmp_path), https=True)
    r = cruzado.get("/api/filtros", headers={"Origin": ORIGEN})
    assert r.headers.get("access-control-allow-origin") == ORIGEN
    assert r.headers.get("access-control-allow-credentials") == "true"

    mismo = make_client(_env(tmp_path, CORS_ORIGINS=""))
    r = mismo.get("/api/filtros", headers={"Origin": "https://otro.example"})
    assert r.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in r.headers
    # Mismo dominio: cookie SameSite=Strict y CSRF opcional
    r = mismo.post("/api/admin/login", json={"username": "admin", "password": CLAVE})
    assert r.status_code == 200 and "samesite=strict" in r.headers["set-cookie"].lower()
    assert _subir(mismo, {}).status_code == 200


def test_seed_copies_missing_from_repo(make_client, tmp_path, capsys, monkeypatch):
    """Almacén vacío: se siembran los conjuntos que falten (aquí solo población, por tamaño)."""
    pub = _sembrar(tmp_path)
    (pub / "pob_municipios.parquet").unlink()
    make_client(_env(tmp_path))
    assert (pub / "pob_municipios.parquet").exists()
    assert "[DATOS] sembrado poblacion desde el repo" in capsys.readouterr().out
