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
Cada carpeta guarda el resumen de cada Parquet como `<conjunto>.json`.
"""

import json
import os
import shutil
import threading
import uuid
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


class UnknownDatasetError(ValidationError):
    """El conjunto no está en la lista cerrada."""


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


def _cfg(dataset: str) -> dict:
    if dataset not in DATASETS:
        raise UnknownDatasetError("Conjunto desconocido")
    return DATASETS[dataset]


def _copiar(origen: Path, destino: Path) -> None:
    """Copia conservando fecha (punto único para pruebas de fallos)."""
    shutil.copy2(origen, destino)


def _reemplazar(origen: Path, destino: Path) -> None:
    """`os.replace`; siempre dentro de la misma carpeta (punto único para pruebas)."""
    os.replace(origen, destino)


def _borrar_silencioso(*rutas: Path | None) -> None:
    for r in rutas:
        if r is None:
            continue
        try:
            r.unlink(missing_ok=True)
        except OSError as e:
            print(f"[DATOS] no se pudo borrar {r.name}: {e}")


def _temporal(carpeta: Path, nombre: str) -> Path:
    """Nombre único `.<nombre>.<uuid>.tmp` (se barren al arrancar)."""
    return carpeta / f".{nombre}.{uuid.uuid4().hex}.tmp"


def _firma_archivo(path: Path) -> list[int]:
    st = path.stat()
    return [st.st_size, st.st_mtime_ns]


def _ahora() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ── Validación y resumen ──────────────────────────────────────────────────────
def _validar(path: Path, dataset: str) -> None:
    """Reglas del spec §4 (la de tamaño se aplica al copiar). Lanza ValidationError."""
    cfg = _cfg(dataset)

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
            # Los negativos se aceptan: son ajustes oficiales del SESNSP (se cuentan en el resumen)
            vacios, no_finitos = con.execute(
                f"SELECT COUNT(*) FILTER (WHERE {v} IS NULL), "
                f"COUNT(*) FILTER (WHERE NOT isfinite(CAST({v} AS DOUBLE))) FROM {src}"
            ).fetchone()
            if vacios:
                raise ValidationError(f"La columna {col} tiene {vacios:,} valores vacíos")
            if no_finitos:
                raise ValidationError(f"La columna {col} tiene {no_finitos:,} valores no finitos (NaN o infinito)")
    finally:
        con.close()


def summarize(path: Path, dataset: str) -> dict:
    """Resumen: filas, años, último mes con total > 0 del año máximo, su total y filas negativas."""
    cfg = _cfg(dataset)
    path = Path(path)
    real = _columnas(path)
    a = _ident(real[nfc(cfg["year_col"])])
    src = _fuente(path)

    con = duckdb.connect()
    try:
        filas, anio_min, anio_max = con.execute(f"SELECT COUNT(*), MIN({a}), MAX({a}) FROM {src}").fetchone()
        ultimo_mes, total, negativos = None, None, None
        if cfg["value_col"]:
            v = _ident(real[nfc(cfg["value_col"])])
            negativos = int(con.execute(f"SELECT COUNT(*) FROM {src} WHERE {v} < 0").fetchone()[0])
        if cfg["month_col"] and anio_max is not None:
            m = _ident(real[nfc(cfg["month_col"])])
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
        "negative_rows": negativos,
        "size_mb": round(st.st_size / (1024 * 1024), 2),
        "at": datetime.fromtimestamp(st.st_mtime).astimezone().isoformat(timespec="seconds"),
    }


def diff(new: dict, old: dict | None) -> dict:
    """Antes/después de lo que el analista revisa al publicar."""
    old = old or {}
    return {k: {"before": old.get(k), "after": new.get(k)}
            for k in ("year_max", "last_month", "total_last_year", "rows")}


# ── Almacén ───────────────────────────────────────────────────────────────────
# Regla de movimientos: todo `os.replace` ocurre dentro de una misma carpeta.
# Entre carpetas solo se copia a un temporal junto al destino y luego se
# reemplaza; así el publicado nunca queda a medias aunque las carpetas estén
# en volúmenes distintos (EXDEV) o Windows niegue un renombre.
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
            # Temporales huérfanos de un proceso interrumpido
            _borrar_silencioso(*d.glob(".*.tmp"))

    # Rutas
    def _pub(self, c: str) -> Path:
        return self.published_dir / _cfg(c)["file"]

    def _stg(self, c: str) -> Path:
        return self.staging_dir / _cfg(c)["file"]

    def _bak(self, c: str) -> Path:
        return self.backup_dir / _cfg(c)["file"]

    # Resúmenes en caché: `<carpeta>/<conjunto>.json`, válidos si coincide la firma
    @staticmethod
    def _json(path: Path, c: str) -> Path:
        return path.parent / f"{c}.json"

    def _guardar_resumen(self, path: Path, c: str, resumen: dict) -> None:
        js = self._json(path, c)
        try:
            js.write_text(json.dumps({**resumen, "_sig": _firma_archivo(path)}, ensure_ascii=False),
                          encoding="utf-8")
        except OSError as e:
            print(f"[DATOS] no se pudo guardar {js.name}: {e}")

    def _resumen(self, path: Path, c: str) -> dict | None:
        """Lee el json; lo recalcula si falta o no corresponde al archivo."""
        if not path.exists():
            return None
        firma = _firma_archivo(path)
        try:
            datos = json.loads(self._json(path, c).read_text(encoding="utf-8"))
            if datos.get("_sig") == firma:
                return {k: v for k, v in datos.items() if k != "_sig"}
        except (OSError, ValueError):
            pass
        resumen = summarize(path, c)
        self._guardar_resumen(path, c, resumen)
        return resumen

    def _resumen_seguro(self, path: Path, c: str) -> dict | None:
        """Como `_resumen`, pero un archivo que desaparece a media lectura cuenta como ausente."""
        try:
            return self._resumen(path, c)
        except (FileNotFoundError, duckdb.IOException):
            return None

    def _bitacora(self, action: str, dataset: str, user: str | None, summary=None, **extra) -> None:
        """Agrega una entrada; si no se puede escribir, avisa y sigue (no revierte la operación)."""
        entrada = {"at": _ahora(), "user": user, "action": action, "dataset": dataset, "summary": summary, **extra}
        try:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entrada, ensure_ascii=False) + "\n")
        except OSError as e:
            print(f"[DATOS] no se pudo escribir la bitácora ({action} {dataset}): {e}")

    def _tomar(self) -> None:
        if not self._lock.acquire(blocking=False):
            raise BusyError("Operación en curso")

    def _poner(self, origen: Path, destino: Path) -> None:
        """Copia `origen` a un temporal junto a `destino` y lo reemplaza de una vez."""
        tmp = _temporal(destino.parent, destino.name)
        try:
            _copiar(origen, tmp)
            _reemplazar(tmp, destino)
        except BaseException:
            _borrar_silencioso(tmp)
            raise

    def _cambiar_publicado(self, c: str, nuevo: Path, action: str, user: str) -> tuple[dict, dict | None]:
        """Pone `nuevo` como publicado y el publicado actual como respaldo.

        Pasos: (1) copia del publicado a un temporal en backup/, (2) copia de
        `nuevo` a un temporal en parquet/ y un solo `os.replace` sobre el
        publicado, (3) recarga, (4) el temporal ocupa el lugar del respaldo.
        Si (1), (2) o (3) fallan, el publicado vuelve a su versión y el
        respaldo no se toca; si falla (4) solo se avisa. Devuelve (resumen del nuevo publicado, resumen del respaldo).
        """
        pub, bak = self._pub(c), self._bak(c)
        res_nuevo = self._resumen(nuevo, c)
        res_viejo = self._resumen(pub, c)
        habia_pub = res_viejo is not None

        bak_tmp = None
        try:
            if habia_pub:
                bak_tmp = _temporal(self.backup_dir, bak.name)
                _copiar(pub, bak_tmp)
            self._poner(nuevo, pub)
        except BaseException:
            _borrar_silencioso(bak_tmp)
            raise

        try:
            self.reload()
        except Exception as e:
            try:
                if habia_pub:
                    self._poner(bak_tmp, pub)
                else:
                    _borrar_silencioso(pub)
            except Exception as e_rev:
                print(f"[DATOS] no se pudo revertir {pub.name}: {e_rev}")
            try:
                self.reload()
            except Exception as e2:
                print(f"[DATOS] la recarga tras revertir también falló: {e2}")
            _borrar_silencioso(bak_tmp)
            self._bitacora(f"{action}_failed", c, user, error=str(e))
            raise

        # El publicado ya cambió: lo que sigue solo avisa si falla
        self._guardar_resumen(pub, c, res_nuevo)
        try:
            if habia_pub:
                _reemplazar(bak_tmp, bak)
                self._guardar_resumen(bak, c, res_viejo)
        except Exception as e:
            _borrar_silencioso(bak_tmp)
            print(f"[DATOS] publicado sin actualizar el respaldo de {c}: {e}")
        return res_nuevo, res_viejo

    # Operaciones
    def seed(self) -> list[str]:
        """Copia desde el repo los conjuntos que falten en publicados (nunca sobrescribe)."""
        copiados = []
        with self._lock:
            for c in DATASETS:
                destino, origen = self._pub(c), self.repo_dir / DATASETS[c]["file"]
                if destino.exists() or not origen.exists():
                    continue
                tmp = _temporal(destino.parent, destino.name)
                try:
                    _copiar(origen, tmp)
                    if destino.exists():  # apareció mientras se copiaba
                        continue
                    _reemplazar(tmp, destino)
                    copiados.append(c)
                finally:
                    _borrar_silencioso(tmp)
        return copiados

    def stage(self, dataset: str, fileobj: BinaryIO, max_bytes: int, user: str | None = None) -> dict:
        """Copia a un temporal único, valida y resume; solo lo validado pasa a staging.

        Devuelve el resumen con `diff` contra el publicado.
        """
        destino = self._stg(dataset)
        tmp = _temporal(self.staging_dir, destino.name)
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

            self._tomar()
            try:
                _reemplazar(tmp, destino)
                self._guardar_resumen(destino, dataset, resumen)
                self._bitacora("upload", dataset, user, resumen)
            finally:
                self._lock.release()
        finally:
            _borrar_silencioso(tmp)
        return {**resumen, "diff": diff(resumen, self._resumen_seguro(self._pub(dataset), dataset))}

    def status(self) -> dict:
        datasets = {}
        for c in DATASETS:
            pub = self._resumen_seguro(self._pub(c), c)
            stg = self._resumen_seguro(self._stg(c), c)
            bak = self._resumen_seguro(self._bak(c), c)
            datasets[c] = {
                "published": pub,
                "staging": None if stg is None else {**stg, "diff": diff(stg, pub)},
                "has_backup": bak is not None,
                "backup": bak,
            }
        return {"persistent": self.persistent, "datasets": datasets}

    def publish(self, dataset: str, user: str) -> dict:
        """Staging → publicado (el anterior queda de respaldo) y recarga; revierte si falla."""
        stg = self._stg(dataset)
        self._tomar()
        try:
            if not stg.exists():
                raise NothingToDoError("No hay archivo en espera")
            resumen, _ = self._cambiar_publicado(dataset, stg, "publish", user)
            _borrar_silencioso(stg, self._json(stg, dataset))
            self._bitacora("publish", dataset, user, resumen)
            return resumen
        finally:
            self._lock.release()

    def restore(self, dataset: str, user: str) -> dict:
        """Intercambia respaldo ↔ publicado y recarga; revierte si falla."""
        bak = self._bak(dataset)
        self._tomar()
        try:
            if not bak.exists():
                raise NothingToDoError("No hay versión anterior para restaurar")
            # El respaldo se copia al publicado antes de que el paso final lo reemplace
            resumen, viejo = self._cambiar_publicado(dataset, bak, "restore", user)
            if viejo is None:  # no había publicado: el respaldo pasó a serlo
                _borrar_silencioso(bak, self._json(bak, dataset))
            self._bitacora("restore", dataset, user, resumen)
            return resumen
        finally:
            self._lock.release()

    def discard(self, dataset: str, user: str) -> None:
        stg = self._stg(dataset)
        self._tomar()
        try:
            if not stg.exists():
                raise NothingToDoError("No hay archivo en espera")
            _borrar_silencioso(stg, self._json(stg, dataset))
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
