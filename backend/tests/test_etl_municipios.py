"""Unificación de nombres de municipio en el ETL offline.

El SESNSP cambió su catálogo en 2026 ("Alamos" -> "Álamos", "Cintalapa" -> "Cintalapa de
Figueroa"): la clave es la misma y el nombre no, lo que partía la serie histórica al filtrar
por municipio.
"""
import pandas as pd

import convertir_datos


def _df(filas):
    return pd.DataFrame(filas, columns=["Año", "Cve. Municipio", "Municipio", "Enero"])


def test_usa_el_nombre_del_anio_mas_reciente():
    df = _df([
        (2024, 26003, "Alamos", 5),
        (2025, 26003, "Alamos", 7),
        (2026, 26003, "Álamos", 3),
        (2025, 7017, "Cintalapa", 1),
        (2026, 7017, "Cintalapa de Figueroa", 2),
        (2025, 26030, "Hermosillo", 9),
        (2026, 26030, "Hermosillo", 8),
    ])

    out, cambios = convertir_datos.unificar_nombres_municipio(df)

    assert set(out.loc[out["Cve. Municipio"] == 26003, "Municipio"]) == {"Álamos"}
    assert set(out.loc[out["Cve. Municipio"] == 7017, "Municipio"]) == {"Cintalapa de Figueroa"}
    assert set(out.loc[out["Cve. Municipio"] == 26030, "Municipio"]) == {"Hermosillo"}
    # Solo cambian los nombres: mismas filas y mismos valores
    assert len(out) == len(df)
    assert out["Enero"].tolist() == df["Enero"].tolist()
    assert sorted((c["clave"], c["antes"], c["ahora"]) for c in cambios) == [
        (7017, "Cintalapa", "Cintalapa de Figueroa"),
        (26003, "Alamos", "Álamos"),
    ]
    assert {c["clave"]: (c["anio_min"], c["anio_max"]) for c in cambios}[26003] == (2024, 2025)


def test_no_toca_las_claves_999():
    # "Otros Municipios" y "No especificado" pueden ser categorías distintas: no se fusionan
    df = _df([
        (2025, 26999, "Otros Municipios", 4),
        (2026, 26999, "No especificado", 0),
    ])

    out, cambios = convertir_datos.unificar_nombres_municipio(df)

    assert out["Municipio"].tolist() == ["Otros Municipios", "No especificado"]
    assert cambios == []


def test_dos_nombres_en_el_anio_mas_reciente_no_se_unifican():
    # Ambiguo: no hay un nombre vigente único, se deja como está
    df = _df([
        (2025, 1001, "Viejo", 1),
        (2026, 1001, "Nuevo A", 1),
        (2026, 1001, "Nuevo B", 1),
    ])

    out, cambios = convertir_datos.unificar_nombres_municipio(df)

    assert out["Municipio"].tolist() == ["Viejo", "Nuevo A", "Nuevo B"]
    assert cambios == []


def test_sin_columnas_de_municipio_no_hace_nada():
    df = pd.DataFrame({"Año": [2026], "Entidad": ["Sonora"], "Enero": [1]})

    out, cambios = convertir_datos.unificar_nombres_municipio(df)

    assert out.equals(df)
    assert cambios == []
