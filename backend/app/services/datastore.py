"""
datastore.py
============
Almacén de Parquet del panel de administración.

    <root>/
      parquet/ (o `published_dir`)  publicados, los lee DuckDB
      staging/                      en espera de publicar
      backup/                       versión anterior (1 por conjunto)
      admin_log.jsonl               bitácora

Los archivos subidos solo se leen con pyarrow y con una conexión DuckDB
efímera (nunca la global de `main.py`); jamás se ejecutan. Los movimientos
usan `os.replace` y las operaciones que tocan publicados van con candado.
Cada Parquet lleva junto su resumen `<nombre>.json`.
"""

import json
import os
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import BinaryIO, Callable

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

from app.schemas_datos import DATASETS, MESES, nfc

BLOQUE = 1024 * 1024
FIRMA = b"PAR1"
ANIO_MIN, ANIO_MAX = 2000, 2100


class ValidationError(Exception):
    """El archivo no cumple las reglas del conjunto."""


class TooLargeError(Exception):
    """El archivo excede el tamaño permitido."""


class NothingToDoError(Exception):
    """No hay nada en espera, o no hay respaldo."""


class BusyError(Exception):
    """Otra operación de publicar/restaurar está en curso."""


# ── Utilidades ────────────────────────────────────────────────────────────────
def _ident(nombre: str) -> str:
    return '"' + nombre.replace('"', '""') + '"'


def _fuente(path: Path) -> str:
    return "read_parquet('" + str(path).replace("'", "''") + "')"


def _columnas(path: Path) -> dict[str, str]:
    """{nombre NFC: nombre real en el archivo}."""
    return {nfc(n): n for n in pq.read_schema(path).names}


def _json_de(path: Path) -> Path:
    return path.with_suffix(".json")


def _firma_archivo(path: Path) -> list[int]:
    st = path.stat()
    return [st.st_size, st.st_mtime_ns]


def _ahora() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ── Validación y resumen ──────────────────────────────────────────────────────
def _validar(path: Path, dataset: str) -> None:
    """Reglas del spec §4 (la de tamaño se aplica al copiar). Lanza ValidationError."""
    cfg = DATASETS[dataset]

    with open(path, "rb") as f:
        inicio = f.read(4)
        if len(inicio) == 4:
            f.seek(-4, os.SEEK_END)
        fin = f.read(4)
    if inicio != FIRMA or fin != FIRMA:
        raise ValidationError("El archivo no es un archivo Parquet válido")

    try:
        esquema = pq.read_schema(path)
    except Exception:
        raise ValidationError("El archivo no es un archivo Parquet válido")

    tipos = {nfc(n): t for n, t in zip(esquema.names, esquema.types)}
    faltan = [c for c in cfg["required"] if nfc(c) not in tipos]
    if faltan:
        raise ValidationError("Faltan columnas: " + ", ".join(faltan))

    real = {nfc(n): n for n in esquema.names}

    def tipo(col):
        t = tipos[nfc(col)]
        return t.value_type if pa.types.is_dictionary(t) else t

    def es_numero(t):
        return pa.types.is_integer(t) or pa.types.is_floating(t) or pa.types.is_decimal(t)

    anio = cfg["year_col"]
    if not pa.types.is_integer(tipo(anio)):
        raise ValidationError(f"La columna {anio} debe ser de números enteros")
    numericas = [cfg["value_col"]] if cfg["value_col"] else [c for c in cfg["required"] if c.startswith("POB_MIT_")]
    for col in numericas:
        if not es_numero(tipo(col)):
            raise ValidationError(f"La columna {col} debe ser numérica")
    mes = cfg["month_col"]
    if mes and not (pa.types.is_string(tipo(mes)) or pa.types.is_large_string(tipo(mes))):
        raise ValidationError(f"La columna {mes} debe ser texto (Enero…Diciembre)")

    con = duckdb.connect()
    try:
        src = _fuente(path)
        a = _ident(real[nfc(anio)])
        filas, vacios, fuera = con.execute(
            f"SELECT COUNT(*), COUNT(*) FILTER (WHERE {a} IS NULL), "
            f"COUNT(*) FILTER (WHERE {a} < {ANIO_MIN} OR {a} > {ANIO_MAX}) FROM {src}"
        ).fetchone()
        if filas < 1:
            raise ValidationError("El archivo no tiene filas")
        if vacios:
            raise ValidationError(f"La columna {anio} tiene {vacios:,} valores vacíos")
        if dataset != "poblacion" and fuera:
            raise ValidationError(f"La columna {anio} tiene {fuera:,} valores fuera de {ANIO_MIN}–{ANIO_MAX}")

        if mes:
            m = _ident(real[nfc(mes)])
            malos = [r[0] for r in con.execute(
                f"SELECT DISTINCT {m} FROM {src} WHERE {m} IS NULL OR {m} NOT IN ({', '.join('?' * len(MESES))}) "
                f"ORDER BY 1 LIMIT 5", MESES).fetchall()]
            if malos:
                raise ValidationError(
                    f"Valores no válidos en {mes}: " + ", ".join("(vacío)" if v is None else str(v) for v in malos))

        for col in numericas:
            v = _ident(real[nfc(col)])
            vacios, negativos = con.execute(
                f"SELECT COUNT(*) FILTER (WHERE {v} IS NULL), COUNT(*) FILTER (WHERE {v} < 0) FROM {src}"
            ).fetchone()
            if vacios:
                raise ValidationError(f"La columna {col} tiene {vacios:,} valores vacíos")
            if dataset != "poblacion" and negativos:
                raise ValidationError(f"La columna {col} tiene {negativos:,} valores negativos")
    finally:
        con.close()


def summarize(path: Path, dataset: str) -> dict:
    """Resumen: filas, años, último mes con total > 0 del año máximo y su total."""
    cfg = DATASETS[dataset]
    path = Path(path)
    real = _columnas(path)
    a = _ident(real[nfc(cfg["year_col"])])
    src = _fuente(path)

    con = duckdb.connect()
    try:
        filas, anio_min, anio_max = con.execute(f"SELECT COUNT(*), MIN({a}), MAX({a}) FROM {src}").fetchone()
        ultimo_mes, total = None, None
        if cfg["month_col"] and anio_max is not None:
            m = _ident(real[nfc(cfg["month_col"])])
            v = _ident(real[nfc(cfg["value_col"])])
            por_mes = dict(con.execute(
                f"SELECT CAST({m} AS VARCHAR), SUM({v}) FROM {src} WHERE {a} = ? GROUP BY 1", [anio_max]
            ).fetchall())
            con_datos = [i for i, nombre in enumerate(MESES) if (por_mes.get(nombre) or 0) > 0]
            if con_datos:
                fin = con_datos[-1]
                ultimo_mes = MESES[fin]
                total = sum(por_mes.get(n) or 0 for n in MESES[: fin + 1])
                total = int(total) if float(total).is_integer() else float(total)
    finally:
        con.close()

    st = path.stat()
    return {
        "rows": int(filas),
        "year_min": None if anio_min is None else int(anio_min),
        "year_max": None if anio_max is None else int(anio_max),
        "last_month": ultimo_mes,
        "total_last_year": total,
        "size_mb": round(st.st_size / (1024 * 1024), 2),
        "at": datetime.fromtimestamp(st.st_mtime).astimezone().isoformat(timespec="seconds"),
    }


def diff(new: dict, old: dict | None) -> dict:
    """Antes/después de lo que el analista revisa al publicar."""
    old = old or {}
    return {k: {"before": old.get(k), "after": new.get(k)}
            for k in ("year_max", "last_month", "total_last_year", "rows")}


# ── Almacén ───────────────────────────────────────────────────────────────────
class DataStore:
    def __init__(self, root: Path, published_dir: Path, repo_dir: Path,
                 reload: Callable[[], None], persistent: bool):
        self.root = Path(root)
        self.published_dir = Path(published_dir)
        self.repo_dir = Path(repo_dir)
        self.staging_dir = self.root / "staging"
        self.backup_dir = self.root / "backup"
        self.log_path = self.root / "admin_log.jsonl"
        self.reload = reload
        self.persistent = persistent
        self._lock = threading.Lock()
        for d in (self.root, self.published_dir, self.staging_dir, self.backup_dir):
            d.mkdir(parents=True, exist_ok=True)

    # Rutas
    def _pub(self, c: str) -> Path:
        return self.published_dir / DATASETS[c]["file"]

    def _stg(self, c: str) -> Path:
        return self.staging_dir / DATASETS[c]["file"]

    def _bak(self, c: str) -> Path:
        return self.backup_dir / DATASETS[c]["file"]

    # Resúmenes en caché
    def _resumen(self, path: Path, c: str) -> dict | None:
        """Lee `<nombre>.json`; lo recalcula si falta o no corresponde al archivo."""
        if not path.exists():
            return None
        js = _json_de(path)
        firma = _firma_archivo(path)
        try:
            datos = json.loads(js.read_text(encoding="utf-8"))
            if datos.get("_sig") == firma:
                return {k: v for k, v in datos.items() if k != "_sig"}
        except (OSError, ValueError):
            pass
        resumen = summarize(path, c)
        try:
            js.write_text(json.dumps({**resumen, "_sig": firma}, ensure_ascii=False), encoding="utf-8")
        except OSError as e:
            print(f"[DATOS] no se pudo guardar {js.name}: {e}")
        return resumen

    @staticmethod
    def _mover(origen: Path, destino: Path) -> None:
        """Mueve el Parquet y su resumen (si existe)."""
        os.replace(origen, destino)
        if _json_de(origen).exists():
            os.replace(_json_de(origen), _json_de(destino))
        elif _json_de(destino).exists():
            _json_de(destino).unlink()

    @staticmethod
    def _borrar(path: Path) -> None:
        for p in (path, _json_de(path)):
            if p.exists():
                p.unlink()

    def _bitacora(self, action: str, dataset: str, user: str | None, summary=None, **extra) -> None:
        entrada = {"at": _ahora(), "user": user, "action": action, "dataset": dataset, "summary": summary, **extra}
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entrada, ensure_ascii=False) + "\n")

    def _tomar(self) -> None:
        if not self._lock.acquire(blocking=False):
            raise BusyError("Operación en curso")

    # Operaciones
    def seed(self) -> list[str]:
        """Copia desde el repo los conjuntos que falten en publicados."""
        copiados = []
        for c in DATASETS:
            destino, origen = self._pub(c), self.repo_dir / DATASETS[c]["file"]
            if not destino.exists() and origen.exists():
                shutil.copy2(origen, destino)
                copiados.append(c)
        return copiados

    def stage(self, dataset: str, fileobj: BinaryIO, max_bytes: int, user: str | None = None) -> dict:
        """Copia a staging, valida y resume. Devuelve el resumen con `diff` contra el publicado."""
        destino = self._stg(dataset)
        tmp = destino.with_name(destino.name + ".tmp")
        try:
            leidos = 0
            with open(tmp, "wb") as out:
                while bloque := fileobj.read(BLOQUE):
                    leidos += len(bloque)
                    if leidos > max_bytes:
                        raise TooLargeError(f"El archivo excede el límite de {max_bytes / (1024 * 1024):.0f} MB")
                    out.write(bloque)
            _validar(tmp, dataset)
            resumen = summarize(tmp, dataset)
        except Exception:
            if tmp.exists():
                tmp.unlink()
            raise

        self._tomar()
        try:
            os.replace(tmp, destino)
            _json_de(destino).write_text(
                json.dumps({**resumen, "_sig": _firma_archivo(destino)}, ensure_ascii=False), encoding="utf-8")
            self._bitacora("upload", dataset, user, resumen)
        finally:
            self._lock.release()
        return {**resumen, "diff": diff(resumen, self._resumen(self._pub(dataset), dataset))}

    def status(self) -> dict:
        datasets = {}
        for c in DATASETS:
            pub = self._resumen(self._pub(c), c)
            stg = self._resumen(self._stg(c), c)
            bak = self._resumen(self._bak(c), c)
            datasets[c] = {
                "published": pub,
                "staging": None if stg is None else {**stg, "diff": diff(stg, pub)},
                "has_backup": bak is not None,
                "backup": bak,
            }
        return {"persistent": self.persistent, "datasets": datasets}

    def publish(self, dataset: str, user: str) -> dict:
        """publicado → backup, staging → publicado, recarga. Si la recarga falla, revierte."""
        self._tomar()
        try:
            stg, pub, bak = self._stg(dataset), self._pub(dataset), self._bak(dataset)
            if not stg.exists():
                raise NothingToDoError("No hay archivo en espera")
            self._resumen(pub, dataset)  # asegura el json del publicado antes de moverlo

            bak_viejo = bak.with_name(bak.name + ".old")
            habia_bak, habia_pub = bak.exists(), pub.exists()
            if habia_bak:
                self._mover(bak, bak_viejo)
            if habia_pub:
                self._mover(pub, bak)
            self._mover(stg, pub)
            try:
                self.reload()
            except Exception as e:
                # Revertir: lo nuevo vuelve a espera, el anterior a publicado
                self._mover(pub, stg)
                if habia_pub:
                    self._mover(bak, pub)
                if habia_bak:
                    self._mover(bak_viejo, bak)
                try:
                    self.reload()
                except Exception as e2:
                    print(f"[DATOS] la recarga tras revertir también falló: {e2}")
                self._bitacora("publish_failed", dataset, user, error=str(e))
                raise
            self._borrar(bak_viejo)
            resumen = self._resumen(pub, dataset)
            self._bitacora("publish", dataset, user, resumen)
            return resumen
        finally:
            self._lock.release()

    def restore(self, dataset: str, user: str) -> dict:
        """Intercambia backup ↔ publicado y recarga. Si la recarga falla, deshace el cambio."""
        self._tomar()
        try:
            pub, bak = self._pub(dataset), self._bak(dataset)
            if not bak.exists():
                raise NothingToDoError("No hay versión anterior para restaurar")
            self._resumen(pub, dataset)
            tmp = pub.with_name(pub.name + ".swap")
            habia_pub = pub.exists()

            def intercambiar():
                if habia_pub:
                    self._mover(pub, tmp)
                self._mover(bak, pub)
                if habia_pub:
                    self._mover(tmp, bak)

            def deshacer():
                if habia_pub:
                    self._mover(bak, tmp)
                self._mover(pub, bak)
                if habia_pub:
                    self._mover(tmp, pub)

            intercambiar()
            try:
                self.reload()
            except Exception as e:
                deshacer()
                try:
                    self.reload()
                except Exception as e2:
                    print(f"[DATOS] la recarga tras revertir también falló: {e2}")
                self._bitacora("restore_failed", dataset, user, error=str(e))
                raise
            resumen = self._resumen(pub, dataset)
            self._bitacora("restore", dataset, user, resumen)
            return resumen
        finally:
            self._lock.release()

    def discard(self, dataset: str, user: str) -> None:
        self._tomar()
        try:
            stg = self._stg(dataset)
            if not stg.exists():
                raise NothingToDoError("No hay archivo en espera")
            self._borrar(stg)
            self._bitacora("discard", dataset, user)
        finally:
            self._lock.release()

    def log(self, limit: int = 50) -> list[dict]:
        """Últimas entradas de la bitácora, la más reciente primero."""
        if not self.log_path.exists():
            return []
        entradas = []
        for linea in self.log_path.read_text(encoding="utf-8").splitlines():
            try:
                entradas.append(json.loads(linea))
            except ValueError:
                continue
        return entradas[::-1][:max(0, limit)]
