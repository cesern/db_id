"""Pruebas del almacén de datos del admin (`app/services/datastore.py`)."""
import io
import json
import unicodedata
from pathlib import Path

import pandas as pd
import pytest

from app.schemas_datos import DATASETS, MESES
from app.services.datastore import (
    BusyError, DataStore, NothingToDoError, TooLargeError, ValidationError,
    diff, summarize,
)


# ── Datos mínimos ─────────────────────────────────────────────────────────────
def _fila_base(req, anio, mes, valor):
    fila = {}
    for col in req:
        if col in ("Año", "Clave_Ent", "Cve. Municipio"):
            fila[col] = anio if col == "Año" else 26
        elif col == "Mes":
            fila[col] = mes
        elif col in ("Incidencia", "Víctimas"):
            fila[col] = valor
        else:
            fila[col] = "X"
    return fila


def df_serie(dataset, periodos, valor=10):
    """`periodos` = [(año, mes), ...]."""
    req = DATASETS[dataset]["required"]
    return pd.DataFrame([_fila_base(req, a, m, valor) for a, m in periodos])


def df_poblacion():
    return pd.DataFrame({
        "CLAVE": [26001, 26002], "CLAVE_ENT": [26, 26], "NOM_ENT": ["Sonora"] * 2,
        "NOM_MUN": ["Aconchi", "Agua Prieta"], "AÑO": [2024, 2025],
        "POB_MIT_MUN": [2500, 90000], "POB_MIT_ENT": [3000000, 3050000],
    })


def a_bytes(df) -> io.BytesIO:
    buf = io.BytesIO()
    df.to_parquet(buf, engine="pyarrow", index=False)
    buf.seek(0)
    return buf


REPO_PARQUET = Path(__file__).resolve().parent.parent / "storage" / "parquet"

PERIODOS_2025 = [(2025, m) for m in MESES]
PERIODOS_2026 = [(2026, m) for m in MESES[:8]]


@pytest.fixture
def entorno(tmp_path):
    """Repo con los 4 conjuntos, almacén vacío y un `reload` espía."""
    repo = tmp_path / "repo"
    repo.mkdir()
    for c in ("delitos", "victimas", "victimas_mun"):
        df_serie(c, PERIODOS_2025, valor=5).to_parquet(repo / DATASETS[c]["file"], index=False)
    df_poblacion().to_parquet(repo / DATASETS["poblacion"]["file"], index=False)

    llamadas = []
    fallos = {"n": 0}

    def reload():
        llamadas.append(1)
        if fallos["n"] > 0:
            fallos["n"] -= 1
            raise RuntimeError("fallo de recarga")

    root = tmp_path / "store"
    store = DataStore(root, root / "parquet", repo, reload, persistent=False)
    store.seed()
    return store, llamadas, fallos


# ── Siembra ───────────────────────────────────────────────────────────────────
def test_seed_copies_missing_from_repo(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    df_serie("delitos", PERIODOS_2025).to_parquet(repo / "delitos.parquet", index=False)
    root = tmp_path / "store"
    (root / "parquet").mkdir(parents=True)
    df_poblacion().to_parquet(root / "parquet" / "pob_municipios.parquet", index=False)

    store = DataStore(root, root / "parquet", repo, lambda: None, persistent=False)
    assert store.seed() == ["delitos"]
    assert (root / "parquet" / "delitos.parquet").exists()
    assert store.seed() == []


# ── Validación ────────────────────────────────────────────────────────────────
def test_stage_rejects_non_parquet(entorno):
    store, _, _ = entorno
    with pytest.raises(ValidationError, match="no es un archivo Parquet"):
        store.stage("delitos", io.BytesIO(b"hola"), max_bytes=10_000)
    assert store.status()["datasets"]["delitos"]["staging"] is None


def test_stage_rejects_too_large(entorno):
    store, _, _ = entorno
    with pytest.raises(TooLargeError):
        store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10)


def test_validate_rejects_wrong_dataset(entorno):
    store, _, _ = entorno
    with pytest.raises(ValidationError) as e:
        store.stage("delitos", a_bytes(df_serie("victimas", PERIODOS_2026)), max_bytes=10**7)
    assert "Cve. Municipio" in str(e.value)
    assert "Faltan columnas" in str(e.value)


def test_validate_accepts_nfd_columns(entorno):
    store, _, _ = entorno
    df = df_serie("delitos", PERIODOS_2026)
    df.columns = [unicodedata.normalize("NFD", c) for c in df.columns]
    assert "Año" not in df.columns  # de verdad está en NFD
    resumen = store.stage("delitos", a_bytes(df), max_bytes=10**7)
    assert resumen["year_max"] == 2026
    assert resumen["last_month"] == "Agosto"


def test_stage_rejects_bad_month(entorno):
    store, _, _ = entorno
    df = df_serie("delitos", [(2026, "Enro"), (2026, "Enero")])
    with pytest.raises(ValidationError, match="Mes"):
        store.stage("delitos", a_bytes(df), max_bytes=10**7)


def test_stage_rejects_bad_year(entorno):
    store, _, _ = entorno
    with pytest.raises(ValidationError, match="Año"):
        store.stage("delitos", a_bytes(df_serie("delitos", [(1999, "Enero")])), max_bytes=10**7)


def test_stage_rejects_null_value(entorno):
    store, _, _ = entorno
    df = df_serie("delitos", PERIODOS_2026).astype({"Incidencia": "float64"})
    df.loc[0, "Incidencia"] = None
    with pytest.raises(ValidationError, match="Incidencia"):
        store.stage("delitos", a_bytes(df), max_bytes=10**7)


def test_negative_values_allowed_and_counted(entorno):
    """Los ajustes del SESNSP llegan como -1: se aceptan y se cuentan."""
    store, _, _ = entorno
    df = pd.concat([df_serie("delitos", PERIODOS_2026, valor=4),
                    df_serie("delitos", [(2026, "Marzo")], valor=-1)])
    summary = store.stage("delitos", a_bytes(df), max_bytes=10**7)
    assert summary["negative_rows"] == 1
    assert summary["total_last_year"] == 4 * 8 - 1


def test_real_published_files_validate(tmp_path):
    """Los Parquet reales del repo deben pasar la validación del admin."""
    archivos = {c: REPO_PARQUET / cfg["file"] for c, cfg in DATASETS.items()}
    if not all(p.exists() for p in archivos.values()):
        pytest.skip("Faltan Parquet reales en storage/parquet")
    root = tmp_path / "store"
    store = DataStore(root, root / "parquet", tmp_path / "vacio", lambda: None, persistent=False)
    for c, ruta in archivos.items():
        with open(ruta, "rb") as f:
            summary = store.stage(c, f, max_bytes=ruta.stat().st_size + 1)
        assert summary["rows"] > 0
        if DATASETS[c]["value_col"]:
            assert summary["negative_rows"] >= 0
        else:
            assert summary["negative_rows"] is None


def test_stage_poblacion(entorno):
    store, _, _ = entorno
    resumen = store.stage("poblacion", a_bytes(df_poblacion()), max_bytes=10**7)
    assert resumen["rows"] == 2
    assert (resumen["year_min"], resumen["year_max"]) == (2024, 2025)
    assert resumen["last_month"] is None and resumen["total_last_year"] is None
    assert resumen["negative_rows"] is None


# ── Resumen ───────────────────────────────────────────────────────────────────
def test_summary_values(tmp_path):
    df = df_serie("delitos", PERIODOS_2025 + PERIODOS_2026, valor=7)
    # Meses de 2026 posteriores a agosto en cero no cuentan como último mes
    df = pd.concat([df, df_serie("delitos", [(2026, "Septiembre")], valor=0)])
    ruta = tmp_path / "delitos.parquet"
    df.to_parquet(ruta, index=False)

    r = summarize(ruta, "delitos")
    assert r["rows"] == 12 + 8 + 1
    assert (r["year_min"], r["year_max"]) == (2025, 2026)
    assert r["last_month"] == "Agosto"
    assert r["total_last_year"] == 7 * 8
    assert r["negative_rows"] == 0
    assert r["size_mb"] >= 0 and r["at"]


def test_diff():
    d = diff({"year_max": 2026, "last_month": "Septiembre", "total_last_year": 100},
             {"year_max": 2026, "last_month": "Agosto", "total_last_year": 90})
    assert d["last_month"] == {"before": "Agosto", "after": "Septiembre"}
    assert d["total_last_year"] == {"before": 90, "after": 100}
    assert diff({"year_max": 1, "last_month": None, "total_last_year": None}, None)["total_last_year"]["before"] is None


def test_status_shape(entorno):
    store, _, _ = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10**7)
    s = store.status()
    assert s["persistent"] is False
    assert set(s["datasets"]) == set(DATASETS)
    d = s["datasets"]["delitos"]
    assert d["published"]["year_max"] == 2025
    assert d["staging"]["year_max"] == 2026
    assert d["staging"]["diff"]["last_month"] == {"before": "Diciembre", "after": "Agosto"}
    assert d["has_backup"] is False and d["backup"] is None
    # El resumen del publicado queda en caché junto al archivo
    assert (store.published_dir / "delitos.json").exists()


# ── Publicar / restaurar / descartar ──────────────────────────────────────────
def _total_publicado(store, c="delitos"):
    return pd.read_parquet(store.published_dir / DATASETS[c]["file"])[DATASETS[c]["value_col"]].sum()


def test_publish_moves_backup_and_reloads(entorno):
    store, llamadas, _ = entorno
    antes = _total_publicado(store)
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7, user="admin")
    publicado = store.publish("delitos", "admin")

    assert publicado["year_max"] == 2026
    assert _total_publicado(store) == 3 * 8
    respaldo = pd.read_parquet(store.root / "backup" / "delitos.parquet")
    assert respaldo["Incidencia"].sum() == antes
    assert len(llamadas) == 1
    assert store.status()["datasets"]["delitos"]["staging"] is None
    assert store.status()["datasets"]["delitos"]["has_backup"] is True
    acciones = [e["action"] for e in store.log()]
    assert acciones[:2] == ["publish", "upload"]  # más reciente primero
    entrada = store.log()[0]
    assert entrada["user"] == "admin" and entrada["dataset"] == "delitos"
    assert entrada["summary"]["year_max"] == 2026 and entrada["at"]


def test_publish_rolls_back_on_reload_error(entorno):
    store, llamadas, fallos = entorno
    antes = _total_publicado(store)
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7)
    fallos["n"] = 1
    with pytest.raises(RuntimeError, match="fallo de recarga"):
        store.publish("delitos", "admin")

    assert _total_publicado(store) == antes
    assert len(llamadas) == 2  # recarga fallida + recarga tras revertir
    st = store.status()["datasets"]["delitos"]
    assert st["has_backup"] is False
    assert st["published"]["year_max"] == 2025
    assert st["staging"] is not None  # lo subido sigue en espera para reintentar
    assert not store._lock.locked()


def test_publish_without_staging_raises(entorno):
    store, _, _ = entorno
    with pytest.raises(NothingToDoError):
        store.publish("delitos", "admin")


def test_restore_swaps(entorno):
    store, llamadas, _ = entorno
    antes = _total_publicado(store)
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7)
    store.publish("delitos", "admin")
    publicado = store.restore("delitos", "admin")

    assert publicado["year_max"] == 2025
    assert _total_publicado(store) == antes
    assert pd.read_parquet(store.root / "backup" / "delitos.parquet")["Incidencia"].sum() == 24
    assert store.status()["datasets"]["delitos"]["backup"]["year_max"] == 2026
    assert len(llamadas) == 2
    assert store.log()[0]["action"] == "restore"


def test_restore_without_backup_raises(entorno):
    store, _, _ = entorno
    with pytest.raises(NothingToDoError):
        store.restore("delitos", "admin")


def test_discard(entorno):
    store, _, _ = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10**7)
    store.discard("delitos", "admin")
    assert store.status()["datasets"]["delitos"]["staging"] is None
    assert store.log()[0]["action"] == "discard"
    with pytest.raises(NothingToDoError):
        store.discard("delitos", "admin")


def test_publish_while_busy_raises(entorno):
    store, _, _ = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10**7)
    store._lock.acquire()
    try:
        with pytest.raises(BusyError):
            store.publish("delitos", "admin")
        with pytest.raises(BusyError):
            store.restore("delitos", "admin")
    finally:
        store._lock.release()


def test_log_limit(entorno):
    store, _, _ = entorno
    for _ in range(3):
        store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10**7, user="admin")
    assert len(store.log(limit=2)) == 2
    lineas = (store.root / "admin_log.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lineas) == 3 and json.loads(lineas[0])["action"] == "upload"


# ── Robustez de movimientos ───────────────────────────────────────────────────
from app.services import datastore as ds  # noqa: E402


def _bytes(p):
    return p.read_bytes() if p.exists() else None


def _temporales(store):
    return [p for d in (store.published_dir, store.staging_dir, store.backup_dir) for p in d.glob(".*.tmp")]


def _preparar_con_respaldo(entorno):
    """Publicado v2, respaldo v1 y v3 en espera."""
    store, _, _ = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=2)), max_bytes=10**7)
    store.publish("delitos", "admin")
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7)
    return store


@pytest.mark.parametrize("operacion", ["publish", "restore"])
@pytest.mark.parametrize("funcion", ["_copiar", "_reemplazar"])
def test_move_failure_at_each_step_keeps_published(entorno, monkeypatch, operacion, funcion):
    store = _preparar_con_respaldo(entorno)
    pub, bak = store._pub("delitos"), store._bak("delitos")
    pub_antes, bak_antes = _bytes(pub), _bytes(bak)
    nuevo = _bytes(store._stg("delitos") if operacion == "publish" else bak)
    original = getattr(ds, funcion)

    paso = 0
    while True:
        paso += 1
        llamadas = {"n": 0}

        def falla(a, b, _paso=paso):
            llamadas["n"] += 1
            if llamadas["n"] == _paso:
                raise PermissionError("[WinError 5] Acceso denegado")
            return original(a, b)

        monkeypatch.setattr(ds, funcion, falla)
        try:
            getattr(store, operacion)("delitos", "admin")
            exito = True
        except PermissionError:
            exito = False
        monkeypatch.setattr(ds, funcion, original)

        assert _bytes(pub) in (pub_antes, nuevo)
        assert not _temporales(store)
        assert not store._lock.locked()
        if not exito:
            assert _bytes(pub) == pub_antes
            assert _bytes(bak) == bak_antes
        if exito or paso > 10:
            break
    assert exito and paso > 1  # se probaron fallos antes de terminar bien


def test_publish_first_time_without_published(entorno):
    store, llamadas, _ = entorno
    store._pub("delitos").unlink()
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7)
    publicado = store.publish("delitos", "admin")
    assert publicado["year_max"] == 2026
    assert _total_publicado(store) == 24
    assert store.status()["datasets"]["delitos"]["has_backup"] is False
    assert len(llamadas) == 1


def test_publish_first_time_rolls_back_to_nothing(entorno):
    store, _, fallos = entorno
    store._pub("delitos").unlink()
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10**7)
    fallos["n"] = 1
    with pytest.raises(RuntimeError):
        store.publish("delitos", "admin")
    assert not store._pub("delitos").exists()
    assert store._stg("delitos").exists()


def test_restore_rolls_back_on_reload_error(entorno):
    store, llamadas, fallos = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7)
    store.publish("delitos", "admin")
    pub_antes, bak_antes = _bytes(store._pub("delitos")), _bytes(store._bak("delitos"))
    fallos["n"] = 1
    with pytest.raises(RuntimeError, match="fallo de recarga"):
        store.restore("delitos", "admin")
    assert _bytes(store._pub("delitos")) == pub_antes
    assert _bytes(store._bak("delitos")) == bak_antes
    assert store.log()[0]["action"] == "restore_failed"
    assert not _temporales(store) and not store._lock.locked()


def test_stage_and_discard_busy(entorno):
    store, _, _ = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026)), max_bytes=10**7)
    store._lock.acquire()
    try:
        with pytest.raises(BusyError):
            store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2025)), max_bytes=10**7)
        with pytest.raises(BusyError):
            store.discard("delitos", "admin")
    finally:
        store._lock.release()
    assert not _temporales(store)
    assert store.status()["datasets"]["delitos"]["staging"]["year_max"] == 2026


def test_unknown_dataset(entorno):
    store, _, _ = entorno
    with pytest.raises(ds.UnknownDatasetError, match="Conjunto desconocido"):
        store.stage("robos", a_bytes(df_poblacion()), max_bytes=10**7)
    for op in (store.publish, store.restore, store.discard):
        with pytest.raises(ds.UnknownDatasetError):
            op("robos", "admin")
    assert issubclass(ds.UnknownDatasetError, ValidationError)


def test_seed_never_overwrites(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    df_serie("delitos", PERIODOS_2025, valor=1).to_parquet(repo / "delitos.parquet", index=False)
    root = tmp_path / "store"
    (root / "parquet").mkdir(parents=True)
    df_serie("delitos", PERIODOS_2026, valor=9).to_parquet(root / "parquet" / "delitos.parquet", index=False)
    antes = (root / "parquet" / "delitos.parquet").read_bytes()

    store = DataStore(root, root / "parquet", repo, lambda: None, persistent=False)
    assert "delitos" not in store.seed()
    assert (root / "parquet" / "delitos.parquet").read_bytes() == antes
    assert not _temporales(store)


def test_rejects_non_finite(entorno):
    store, _, _ = entorno
    df = df_serie("delitos", PERIODOS_2026).astype({"Incidencia": "float64"})
    df.loc[0, "Incidencia"] = float("inf")
    with pytest.raises(ValidationError, match="no finitos"):
        store.stage("delitos", a_bytes(df), max_bytes=10**7)
    assert not _temporales(store)


def test_log_failure_does_not_fail_publish(entorno, monkeypatch):
    store, _, _ = entorno
    store.stage("delitos", a_bytes(df_serie("delitos", PERIODOS_2026, valor=3)), max_bytes=10**7)
    store.log_path = store.root / "no-existe" / "admin_log.jsonl"
    assert store.publish("delitos", "admin")["year_max"] == 2026
    assert _total_publicado(store) == 24


def test_status_tolerates_vanishing_file(entorno, monkeypatch):
    store, _, _ = entorno
    real = ds.summarize

    def desaparece(path, c):
        if c == "victimas":
            raise FileNotFoundError(path)
        return real(path, c)

    for js in store.published_dir.glob("*.json"):
        js.unlink()
    monkeypatch.setattr(ds, "summarize", desaparece)
    s = store.status()
    assert s["datasets"]["victimas"]["published"] is None
    assert s["datasets"]["delitos"]["published"]["year_max"] == 2025
