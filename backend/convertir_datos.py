"""
convertir_datos.py
==================
Convierte los CSV de delitos y víctimas al formato Parquet que consume el backend.

Los CSV tienen los meses como columnas individuales (Enero, Febrero, ..., Diciembre).
Este script hace un melt() para convertirlos a filas (Mes, Incidencia).

Antes de guardar, realiza un análisis automático de tipos para determinar si vale
la pena optimizar las columnas (int downcast + category), aplicando las conversiones
solo si son seguras y el ahorro de memoria es significativo.

Uso:
    python convertir_datos.py
    python convertir_datos.py --delitos ruta/a/delitos.csv --victimas ruta/a/victimas.csv
"""

import sys
import time
import argparse
import unicodedata
from pathlib import Path
from dataclasses import dataclass, field

try:
    import pandas as pd
    import numpy as np
except ImportError:
    print("ERROR: pandas/numpy no están instalados. Activa el venv e instala los requisitos:")
    print("  pip install -r requirements.txt")
    sys.exit(1)

# ── Configuración ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "storage" / "uploads"
PARQUET_DIR = BASE_DIR / "storage" / "parquet"

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

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

# Umbrales de tipos enteros (min, max) para downcast seguro
INT_RANGES = {
    "int8":  (np.iinfo(np.int8).min,  np.iinfo(np.int8).max),    # -128 … 127
    "int16": (np.iinfo(np.int16).min, np.iinfo(np.int16).max),   # -32768 … 32767
    "int32": (np.iinfo(np.int32).min, np.iinfo(np.int32).max),   # -2.1B … 2.1B
    "int64": (np.iinfo(np.int64).min, np.iinfo(np.int64).max),   # sin límite práctico
}

# Columnas de texto candidatas a convertir a 'category'
COLUMNAS_CATEGORY_CANDIDATAS = {
    "Entidad", "Mes", "Tipo de delito", "Subtipo de delito",
    "Modalidad", "Bien jurídico afectado", "Sexo", "Rango de edad", "Municipio"
}

# Umbral mínimo de ahorro para aplicar la optimización (10% del tamaño total)
UMBRAL_AHORRO_PORCENTAJE = 10.0


# ── Dataclass de resultado del análisis ───────────────────────────────────────
@dataclass
class ResultadoAnalisis:
    memoria_antes_mb: float = 0.0
    memoria_despues_mb: float = 0.0
    conversiones_int: dict = field(default_factory=dict)      # col → tipo nuevo
    conversiones_cat: list = field(default_factory=list)       # cols convertidas a category
    omitidas_overflow: list = field(default_factory=list)      # cols int no convertidas
    omitidas_baja_ganancia: list = field(default_factory=list) # cols cat no convertidas
    se_aplico: bool = False


def _fmt_mb(bytes_: int) -> str:
    return f"{bytes_ / (1024 ** 2):.2f} MB"


# ── Análisis automático de tipos ──────────────────────────────────────────────
def analizar_y_optimizar(df: pd.DataFrame, nombre: str) -> tuple[pd.DataFrame, ResultadoAnalisis]:
    """
    Analiza el DataFrame y aplica optimizaciones de tipo si son seguras y rentables.

    Retorna el DataFrame (posiblemente modificado) y un ResultadoAnalisis con el detalle.
    """
    r = ResultadoAnalisis()
    r.memoria_antes_mb = df.memory_usage(deep=True).sum() / (1024 ** 2)

    sep = "─" * 60
    print(f"\n  {sep}")
    print(f"  ANÁLISIS DE OPTIMIZACIÓN DE TIPOS — {nombre}")
    print(f"  {sep}")

    df_opt = df.copy()

    # ── 1. Columnas numéricas: downcast de int64 ──────────────────────────────
    print("\n  [1] Columnas numéricas (downcast de int64)")
    cols_int = [c for c in df_opt.columns if df_opt[c].dtype == np.int64]

    for col in cols_int:
        col_min = int(df_opt[col].min())
        col_max = int(df_opt[col].max())
        tipo_original = str(df_opt[col].dtype)

        # Determinar el tipo más pequeño que soporta el rango
        tipo_destino = None
        for tipo_candidato in ("int8", "int16", "int32"):
            rng_min, rng_max = INT_RANGES[tipo_candidato]
            if col_min >= rng_min and col_max <= rng_max:
                tipo_destino = tipo_candidato
                break

        if tipo_destino is None or tipo_destino == tipo_original:
            # int64 es necesario o ya es el tipo correcto
            r.omitidas_overflow.append(col)
            print(f"    ✗ {col:35s}  rango [{col_min:,} … {col_max:,}]  →  mantiene int64 (overflow risk)")
            continue

        mem_antes = df_opt[col].memory_usage(deep=True)
        df_opt[col] = df_opt[col].astype(tipo_destino)
        mem_despues = df_opt[col].memory_usage(deep=True)
        ahorro = mem_antes - mem_despues

        r.conversiones_int[col] = (tipo_original, tipo_destino)
        print(f"    ✓ {col:35s}  rango [{col_min:,} … {col_max:,}]  →  {tipo_original} → {tipo_destino}  "
              f"(ahorro: {_fmt_mb(ahorro)})")

    # ── 2. Columnas de texto: conversión a category ───────────────────────────
    print("\n  [2] Columnas de texto (conversión a 'category')")
    cols_object = [c for c in df_opt.columns
                   if df_opt[c].dtype == object and c in COLUMNAS_CATEGORY_CANDIDATAS]

    for col in cols_object:
        n_unique = df_opt[col].nunique()
        n_total  = len(df_opt[col])
        ratio    = n_unique / n_total  # cardinalidad relativa

        mem_antes = df_opt[col].memory_usage(deep=True)
        df_cat    = df_opt[col].astype("category")
        mem_cat   = df_cat.memory_usage(deep=True)
        ahorro    = mem_antes - mem_cat
        pct_ahorro = (ahorro / mem_antes * 100) if mem_antes > 0 else 0

        if pct_ahorro < 5.0:
            # Poca ganancia: no vale la pena (alta cardinalidad)
            r.omitidas_baja_ganancia.append(col)
            print(f"    ✗ {col:35s}  únicos: {n_unique:,}/{n_total:,} ({ratio:.1%})  "
                  f"→  ahorro {pct_ahorro:.1f}% — no aplicado (baja ganancia)")
            continue

        df_opt[col] = df_cat
        r.conversiones_cat.append(col)
        print(f"    ✓ {col:35s}  únicos: {n_unique:,}/{n_total:,} ({ratio:.1%})  "
              f"→  ahorro {_fmt_mb(ahorro)} ({pct_ahorro:.1f}%)")

    # ── 3. Evaluar si el ahorro total justifica la optimización ───────────────
    r.memoria_despues_mb = df_opt.memory_usage(deep=True).sum() / (1024 ** 2)
    ahorro_total_mb  = r.memoria_antes_mb - r.memoria_despues_mb
    pct_reduccion    = (ahorro_total_mb / r.memoria_antes_mb * 100) if r.memoria_antes_mb > 0 else 0

    print(f"\n  [3] Evaluación del ahorro total")
    print(f"    RAM antes      : {r.memoria_antes_mb:.2f} MB")
    print(f"    RAM después    : {r.memoria_despues_mb:.2f} MB")
    print(f"    Ahorro total   : {ahorro_total_mb:.2f} MB ({pct_reduccion:.1f}%)")
    print(f"    Umbral mínimo  : {UMBRAL_AHORRO_PORCENTAJE:.0f}%")

    if pct_reduccion >= UMBRAL_AHORRO_PORCENTAJE:
        r.se_aplico = True
        print(f"    → Optimización APLICADA ✓  (reducción {pct_reduccion:.1f}% ≥ umbral {UMBRAL_AHORRO_PORCENTAJE:.0f}%)")
        return df_opt, r
    else:
        r.se_aplico = False
        print(f"    → Optimización NO aplicada  (reducción {pct_reduccion:.1f}% < umbral {UMBRAL_AHORRO_PORCENTAJE:.0f}%)")
        print(f"      Se guardará con los tipos originales.")
        return df, r


# ── Resumen final del análisis ────────────────────────────────────────────────
def imprimir_resumen(r: ResultadoAnalisis, tam_parquet_mb: float, nombre: str) -> None:
    sep = "═" * 60
    print(f"\n  {sep}")
    print(f"  RESUMEN DE OPTIMIZACIÓN — {nombre}")
    print(f"  {sep}")

    print(f"\n  Memoria RAM:")
    print(f"    Antes   : {r.memoria_antes_mb:.2f} MB")
    print(f"    Después : {r.memoria_despues_mb:.2f} MB")
    ahorro_mb  = r.memoria_antes_mb - r.memoria_despues_mb
    pct        = (ahorro_mb / r.memoria_antes_mb * 100) if r.memoria_antes_mb > 0 else 0
    print(f"    Ahorro  : {ahorro_mb:.2f} MB ({pct:.1f}%)")

    if r.conversiones_int:
        print(f"\n  Downcast de enteros aplicado ({len(r.conversiones_int)} columnas):")
        for col, (antes, despues) in r.conversiones_int.items():
            print(f"    • {col}: {antes} → {despues}")

    if r.conversiones_cat:
        print(f"\n  Conversión a 'category' aplicada ({len(r.conversiones_cat)} columnas):")
        for col in r.conversiones_cat:
            print(f"    • {col}")

    if r.omitidas_overflow:
        print(f"\n  Columnas int NO convertidas (riesgo de overflow):")
        for col in r.omitidas_overflow:
            print(f"    ✗ {col}")

    if r.omitidas_baja_ganancia:
        print(f"\n  Columnas texto NO convertidas (baja ganancia < 5%):")
        for col in r.omitidas_baja_ganancia:
            print(f"    ✗ {col}")

    compresion = "zstd" if r.se_aplico else "snappy (default)"
    print(f"\n  Parquet guardado:")
    print(f"    Tamaño en disco : {tam_parquet_mb:.2f} MB")
    print(f"    Compresión      : {compresion}")
    print(f"    Motor           : pyarrow")
    print(f"    Optimización    : {'✓ APLICADA' if r.se_aplico else '✗ no aplicada'}")
    print(f"  {'═'*60}")


# ── Función principal de conversión ──────────────────────────────────────────
def convertir_csv(ruta_csv: Path, columnas_id: list, salida_parquet: Path, nombre: str) -> bool:
    """Lee un CSV con meses como columnas, aplica análisis de tipos y guarda como Parquet."""
    print(f"\n{'='*60}")
    print(f"Procesando: {nombre}")
    print(f"  Origen  : {ruta_csv}")
    print(f"  Destino : {salida_parquet}")
    print(f"{'='*60}")

    if not ruta_csv.exists():
        print(f"  [ADVERTENCIA] Archivo no encontrado: {ruta_csv}")
        return False

    inicio_total = time.time()

    # ── Leer encabezados ──────────────────────────────────────────────────────
    print("  Leyendo encabezados del CSV...")

    def nfc(s: str) -> str:
        return unicodedata.normalize("NFC", s)

    def reparar_encoding(s: str) -> str:
        """Repara columnas con doble-encoding (bytes UTF-8 leidos como latin-1)."""
        try:
            # Si el string vino de latin-1 pero los bytes originales eran UTF-8:
            # re-encode a latin-1 y decodificar como UTF-8.
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            return s  # ya estaba bien o no se puede reparar

    # Intentamos utf-8-sig primero (elimina BOM automaticamente),
    # luego latin-1 como fallback.
    for enc in ("utf-8-sig", "latin-1"):
        try:
            encabezados_raw = pd.read_csv(ruta_csv, encoding=enc, nrows=0).columns.tolist()
            # Reparar posible doble-encoding en los nombres
            encabezados = [nfc(reparar_encoding(h)) for h in encabezados_raw]
            encoding_csv = enc
            break
        except Exception:
            continue
    else:
        print(f"  [ERROR] No se pudo leer el CSV con ninguno de los encodings.")
        return False

    encabezados_nfc = [nfc(h) for h in encabezados]

    meses_presentes = [m for m in MESES if nfc(m) in encabezados_nfc]
    if not meses_presentes:
        print(f"  [ERROR] No se encontraron columnas de meses en el CSV.")
        print(f"  Columnas encontradas: {encabezados}")
        return False

    # Mapear cada columna ID al nombre real en el CSV (insensible a variantes NFC)
    cols_id_presentes = []
    for c in columnas_id:
        c_nfc = nfc(c)
        if c_nfc in encabezados_nfc:
            # Recuperar el nombre original del CSV (para usarlo en read_csv)
            idx = encabezados_nfc.index(c_nfc)
            cols_id_presentes.append(encabezados[idx])
        else:
            print(f"  [ADVERTENCIA] Columna ID no encontrada en CSV: '{c}' — se omitirá")

    # Verificar columnas críticas
    cols_nfc_presentes = {nfc(c) for c in cols_id_presentes}
    for critica in columnas_id:
        if nfc(critica) not in cols_nfc_presentes:
            print(f"  [ADVERTENCIA] Columna crítica ausente: '{critica}' — el Parquet puede quedar incompleto")
    print(f"  Meses detectados  : {len(meses_presentes)} ({', '.join(meses_presentes[:3])}...)")
    print(f"  Columnas ID       : {len(cols_id_presentes)}")

    # Leer el CSV usando el mismo encoding detectado y los nombres ORIGINALES del CSV
    # (cols_id_presentes contiene nombres ya reparados/NFC que coinciden con los del df)
    print("  Leyendo CSV completo...")
    inicio = time.time()
    try:
        # Usamos los nombres originales (sin reparar) para usecols, luego renombramos
        cols_originales_meses  = [encabezados_raw[encabezados.index(nfc(reparar_encoding(m)))] 
                                   if nfc(reparar_encoding(m)) in encabezados else m
                                   for m in meses_presentes]
        cols_originales_id = [encabezados_raw[encabezados.index(c)] for c in cols_id_presentes]

        df = pd.read_csv(
            ruta_csv,
            encoding=encoding_csv,
            usecols=cols_originales_id + cols_originales_meses,
            low_memory=False
        )
        # Renombrar columnas al nombre reparado/NFC
        rename_map = {
            **{orig: rep for orig, rep in zip(cols_originales_id, cols_id_presentes)},
            **{orig: mes for orig, mes in zip(cols_originales_meses, meses_presentes)},
        }
        df = df.rename(columns=rename_map)
    except Exception as e:
        print(f"  [ERROR] Fallo al leer el CSV: {e}")
        return False

    t_lectura = time.time() - inicio
    print(f"  Filas leídas      : {len(df):,}  ({t_lectura:.1f}s)")

    val_col = "Víctimas" if "víct" in nombre.lower() or "vict" in nombre.lower() else "Incidencia"

    # ── Melt: columnas de meses → filas ──────────────────────────────────────
    print("  Aplicando melt (columnas de meses -> filas)...")
    inicio = time.time()
    df_long = df.melt(
        id_vars=cols_id_presentes,
        value_vars=meses_presentes,
        var_name="Mes",
        value_name=val_col
    )
    t_melt = time.time() - inicio
    print(f"  Filas tras melt   : {len(df_long):,}  ({t_melt:.1f}s)")

    # ── Limpieza ──────────────────────────────────────────────────────────────
    df_long[val_col] = pd.to_numeric(df_long[val_col], errors="coerce")
    df_long = df_long.dropna(subset=[val_col])
    df_long[val_col] = df_long[val_col].astype("int64")  # int64 base para analisis
    print(f"  Filas (sin nulos) : {len(df_long):,}")

    # Normalizar nombres de columnas a NFC (por seguridad, aunque ya deberían estarlo)
    df_long.columns = [unicodedata.normalize("NFC", c) for c in df_long.columns]

    # ── Análisis automático de tipos ──────────────────────────────────────────
    df_final, resultado = analizar_y_optimizar(df_long, nombre)

    # ── Guardar Parquet ───────────────────────────────────────────────────────
    print("\n  Guardando Parquet...")
    inicio = time.time()
    salida_parquet.parent.mkdir(parents=True, exist_ok=True)

    compresion = "zstd" if resultado.se_aplico else "snappy"
    df_final.to_parquet(salida_parquet, index=False, engine="pyarrow", compression=compresion)

    t_parquet = time.time() - inicio
    tam_mb = salida_parquet.stat().st_size / (1024 * 1024)

    # ── Resumen final ─────────────────────────────────────────────────────────
    imprimir_resumen(resultado, tam_mb, nombre)

    t_total = time.time() - inicio_total
    print(f"\n  Tiempo total: {t_total:.1f}s")
    print(f"  [OK] {salida_parquet.name} generado correctamente.\n")
    return True


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Convierte CSV de incidencia delictiva a Parquet optimizado."
    )
    parser.add_argument("--delitos", type=Path, default=UPLOADS_DIR / "delitos_combinado.csv",
                        help="Ruta al CSV de delitos (default: storage/uploads/delitos_combinado.csv)")
    parser.add_argument("--victimas", type=Path, default=UPLOADS_DIR / "victimas_combinado.csv",
                        help="Ruta al CSV de víctimas (default: storage/uploads/victimas_combinado.csv)")
    parser.add_argument("--victimas-mun", type=Path, default=UPLOADS_DIR / "victimas_combinado_municipal_2026.csv",
                        help="Ruta al CSV de víctimas municipal (default: storage/uploads/victimas_combinado_municipal_2026.csv)")
    parser.add_argument("--salida-delitos", type=Path, default=PARQUET_DIR / "delitos.parquet",
                        help="Ruta de salida del Parquet de delitos")
    parser.add_argument("--salida-victimas", type=Path, default=PARQUET_DIR / "victimas.parquet",
                        help="Ruta de salida del Parquet de víctimas")
    parser.add_argument("--salida-victimas-mun", type=Path, default=PARQUET_DIR / "victimas_mun.parquet",
                        help="Ruta de salida del Parquet de víctimas municipal")
    parser.add_argument("--poblacion", type=Path, default=DATA_DIR / "pob_municipios.csv",
                        help="Ruta al CSV de población (opcional)")
    parser.add_argument("--salida-poblacion", type=Path, default=PARQUET_DIR / "pob_municipios.parquet",
                        help="Ruta de salida del Parquet de población")
    args = parser.parse_args()

    inicio_global = time.time()
    resultados = []

    resultados.append(convertir_csv(
        ruta_csv=args.delitos,
        columnas_id=COLUMNAS_ID_DELITOS,
        salida_parquet=args.salida_delitos,
        nombre="Delitos"
    ))

    resultados.append(convertir_csv(
        ruta_csv=args.victimas,
        columnas_id=COLUMNAS_ID_VICTIMAS,
        salida_parquet=args.salida_victimas,
        nombre="Víctimas"
    ))

    resultados.append(convertir_csv(
        ruta_csv=args.victimas_mun,
        columnas_id=COLUMNAS_ID_VICTIMAS_MUN,
        salida_parquet=args.salida_victimas_mun,
        nombre="Víctimas Municipios"
    ))

    # Procesar población si existe
    if args.poblacion.exists():
        resultados.append(convertir_poblacion_csv(
            ruta_csv=args.poblacion,
            salida_parquet=args.salida_poblacion,
            nombre="Población"
        ))

    t_global = time.time() - inicio_global
    exitosos = sum(1 for r in resultados if r)
    print(f"{'='*60}")
    print(f"Proceso global completado en {t_global:.1f}s")
    print(f"Archivos generados: {exitosos}/{len(resultados)}")
    if exitosos < len(resultados):
        sys.exit(1)


def convertir_poblacion_csv(ruta_csv: Path, salida_parquet: Path, nombre="Población") -> bool:
    if not ruta_csv.exists():
        return False
        
    print(f"\n{BARRA}\n  Procesando: {nombre}\n  Archivo: {ruta_csv}\n{BARRA}")
    inicio = time.time()
    try:
        import chardet
        # Detectar encoding
        with open(ruta_csv, 'rb') as f:
            raw = f.read(100000)
            resultado = chardet.detect(raw)
            encoding_csv = resultado['encoding'] or 'latin-1'
            
        print(f"  Encoding detectado: {encoding_csv}")
        
        # Leer el CSV
        df = pd.read_csv(ruta_csv, encoding=encoding_csv, low_memory=False)
        
        # Reparar nombres de columnas (quitar acentos rotos como AO -> AÑO)
        rename_map = {c: nfc(reparar_encoding(c)) for c in df.columns}
        df.rename(columns=rename_map, inplace=True)
        
        # Guardar a Parquet
        df.to_parquet(salida_parquet, engine="pyarrow", compression="snappy", index=False)
        
        t_total = time.time() - inicio
        peso_mb = salida_parquet.stat().st_size / (1024 * 1024)
        print(f"  [EXITO] Parquet guardado: {salida_parquet.name} ({peso_mb:.1f} MB)")
        print(f"  Tiempo total: {t_total:.2f}s")
        return True
    except Exception as e:
        print(f"  [ERROR] Fallo al procesar {nombre}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    main()
