"""Conversión de población en el ETL offline (antes fallaba con NameError)."""
import pandas as pd

import convertir_datos


def test_convertir_poblacion_csv_latin1(tmp_path):
    csv = tmp_path / "pob.csv"
    contenido = (
        "CLAVE,CLAVE_ENT,NOM_ENT,NOM_MUN,AÑO,POB_MIT_MUN,POB_MIT_ENT\n"
        "26030,26,Sonora,Hermosillo,2024,950000,3000000\n"
        "26055,26,Sonora,San Luis Río Colorado,2024,200000,3000000\n"
    )
    csv.write_bytes(contenido.encode("latin-1"))
    out = tmp_path / "pob.parquet"

    assert convertir_datos.convertir_poblacion_csv(csv, out) is True

    df = pd.read_parquet(out)
    assert "AÑO" in df.columns
    assert len(df) == 2
