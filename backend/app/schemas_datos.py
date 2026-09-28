"""
schemas_datos.py
================
Fuente única de columnas de los conjuntos de datos, compartida por el ETL
offline (`convertir_datos.py`) y el panel de administración.

Sin dependencias fuera de la stdlib para que el ETL pueda importarlo suelto.
"""

import unicodedata


def nfc(s: str) -> str:
    """Normaliza a NFC (los nombres con tilde pueden venir en NFD)."""
    return unicodedata.normalize("NFC", s)


MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

# ── Columnas ID de los CSV anchos (antes del melt) ────────────────────────────
COLUMNAS_ID_DELITOS = [
    "Año", "Clave_Ent", "Entidad", "Cve. Municipio", "Municipio",
    "Bien jurídico afectado", "Tipo de delito", "Subtipo de delito", "Modalidad"
]

COLUMNAS_ID_VICTIMAS = [
    "Año", "Clave_Ent", "Entidad", "Bien jurídico afectado", "Tipo de delito", "Subtipo de delito", "Modalidad", "Sexo", "Rango de edad"
]

COLUMNAS_ID_VICTIMAS_MUN = [
    "Año", "Clave_Ent", "Entidad", "Cve. Municipio", "Municipio",
    "Bien jurídico afectado", "Tipo de delito", "Subtipo de delito", "Modalidad", "Sexo", "Rango de edad"
]

COLUMNAS_POBLACION = [
    "CLAVE", "CLAVE_ENT", "NOM_ENT", "NOM_MUN", "AÑO", "POB_MIT_MUN", "POB_MIT_ENT"
]

# ── Conjuntos publicados (Parquet largo, después del melt) ────────────────────
DATASETS: dict[str, dict] = {
    "delitos": {
        "file": "delitos.parquet",
        "label": "Delitos",
        "required": COLUMNAS_ID_DELITOS + ["Mes", "Incidencia"],
        "value_col": "Incidencia",
        "year_col": "Año",
        "month_col": "Mes",
    },
    "victimas": {
        "file": "victimas.parquet",
        "label": "Víctimas",
        "required": COLUMNAS_ID_VICTIMAS + ["Mes", "Víctimas"],
        "value_col": "Víctimas",
        "year_col": "Año",
        "month_col": "Mes",
    },
    "victimas_mun": {
        "file": "victimas_mun.parquet",
        "label": "Víctimas por municipio",
        "required": COLUMNAS_ID_VICTIMAS_MUN + ["Mes", "Víctimas"],
        "value_col": "Víctimas",
        "year_col": "Año",
        "month_col": "Mes",
    },
    "poblacion": {
        "file": "pob_municipios.parquet",
        "label": "Población",
        "required": list(COLUMNAS_POBLACION),
        "value_col": None,
        "year_col": "AÑO",
        "month_col": None,
    },
}
