"""Pruebas del módulo compartido de columnas (`app/schemas_datos.py`)."""
from pathlib import Path

import pyarrow.parquet as pq
import pytest

from app.schemas_datos import DATASETS, MESES, nfc

PARQUET_DIR = Path(__file__).resolve().parent.parent / "storage" / "parquet"


def test_victimas_mun_extiende_victimas():
    req_mun = set(DATASETS["victimas_mun"]["required"])
    assert set(DATASETS["victimas"]["required"]) <= req_mun
    assert "Municipio" in req_mun


def test_poblacion_archivo():
    assert DATASETS["poblacion"]["file"] == "pob_municipios.parquet"


def test_meses():
    assert len(MESES) == 12
    assert MESES[0] == "Enero" and MESES[-1] == "Diciembre"


@pytest.mark.parametrize("clave", ["delitos", "victimas", "victimas_mun", "poblacion"])
def test_required_coincide_con_parquet(clave):
    info = DATASETS[clave]
    for k in ("file", "label", "required", "value_col", "year_col", "month_col"):
        assert k in info
    ruta = PARQUET_DIR / info["file"]
    if not ruta.exists():
        pytest.skip(f"No existe {ruta}")
    columnas = {nfc(c) for c in pq.read_schema(ruta).names}
    faltantes = [c for c in info["required"] if nfc(c) not in columnas]
    assert faltantes == []
