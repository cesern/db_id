from typing import Optional
from enum import Enum
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import time
import duckdb
import pandas as pd
from app.config import settings

class DatasetEnum(str, Enum):
    delitos = "delitos"
    victimas = "victimas"
    victimas_mun = "victimas_mun"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(settings.data_dir)
PARQUET_DIR = Path(settings.parquet_dir)

from app.routes import admin

# Initialize DuckDB in-memory and create views to parquet files
db = duckdb.connect(':memory:')

def reload_duckdb_views():
    # Drop existing views to recreate them
    views_to_drop = ["delitos", "victimas", "victimas_mun", "poblacion"]
    for v in views_to_drop:
        try:
            db.cursor().execute(f"DROP VIEW IF EXISTS {v}")
        except Exception:
            pass

    # Create views if files exist
    if (PARQUET_DIR / "delitos.parquet").exists():
        db.cursor().execute(f"CREATE VIEW delitos AS SELECT * FROM read_parquet('{PARQUET_DIR}/delitos.parquet')")
    if (PARQUET_DIR / "victimas.parquet").exists():
        db.cursor().execute(f"CREATE VIEW victimas AS SELECT * FROM read_parquet('{PARQUET_DIR}/victimas.parquet')")
    if (PARQUET_DIR / "victimas_mun.parquet").exists():
        db.cursor().execute(f"CREATE VIEW victimas_mun AS SELECT * FROM read_parquet('{PARQUET_DIR}/victimas_mun.parquet')")
    if (PARQUET_DIR / "pob_municipios.parquet").exists():
        db.cursor().execute(f"CREATE VIEW poblacion AS SELECT * FROM read_parquet('{PARQUET_DIR}/pob_municipios.parquet')")

# Initial load
reload_duckdb_views()

app.include_router(admin.router)

def get_columns(dataset_name: str) -> list[str]:
    try:
        return [r[1] for r in db.cursor().execute(f"PRAGMA table_info({dataset_name})").fetchall()]
    except Exception:
        return []

def get_poblacion_valor(anio: int, entidad: Optional[str] = "All", municipio: Optional[str] = "All") -> int:
    y = int(anio) if anio is not None else 2026
    
    # Check nearest available year in poblacion
    try:
        query_years = "SELECT DISTINCT AÑO FROM poblacion"
        avail_years = [r[0] for r in db.cursor().execute(query_years).fetchall()]
        if not avail_years: return 0
        if y not in avail_years:
            y = min(avail_years, key=lambda x: abs(x - y))
    except Exception:
        return 0

    if municipio and municipio != "All" and entidad and entidad != "All":
        # Resolve Cve. Municipio using delitos view
        res = db.cursor().execute('SELECT "Cve. Municipio" FROM delitos WHERE Entidad = ? AND Municipio = ? LIMIT 1', [entidad, municipio]).fetchone()
        if res and res[0] is not None:
            cve_mun = int(res[0])
            pop_res = db.cursor().execute('SELECT MAX(POB_MIT_MUN) FROM poblacion WHERE AÑO = ? AND CLAVE = ?', [y, cve_mun]).fetchone()
            if pop_res and pop_res[0]: return int(pop_res[0])
        return 0
        
    if entidad and entidad != "All":
        # Resolve Clave_Ent
        res = db.cursor().execute('SELECT Clave_Ent FROM delitos WHERE Entidad = ? LIMIT 1', [entidad]).fetchone()
        if res and res[0] is not None:
            cve_ent = int(res[0])
            pop_res = db.cursor().execute('SELECT MAX(POB_MIT_ENT) FROM poblacion WHERE AÑO = ? AND CLAVE_ENT = ? GROUP BY CLAVE_ENT', [y, cve_ent]).fetchone()
            if pop_res and pop_res[0]: return int(pop_res[0])
        return 0
        
    # National
    pop_res = db.cursor().execute('SELECT SUM(POB_MIT_ENT) FROM (SELECT DISTINCT CLAVE_ENT, POB_MIT_ENT FROM poblacion WHERE AÑO = ?)', [y]).fetchone()
    if pop_res and pop_res[0]: return int(pop_res[0])
    return 0

def build_where(dataset: DatasetEnum, anio=None, entidad=None, meses=None, bienJuridico=None, tipoDelito=None, subtipoDelito=None, modalidad=None, municipio=None, sexo=None, rangoEdad=None, additional_clause=None):
    valid_cols = get_columns(dataset.value)
    where_clauses = []
    params = []
    
    if anio is not None and "Año" in valid_cols:
        where_clauses.append('"Año" = ?')
        params.append(anio)
    if entidad is not None and entidad != "All" and "Entidad" in valid_cols:
        where_clauses.append('Entidad = ?')
        params.append(entidad)
    if municipio is not None and municipio != "All" and "Municipio" in valid_cols:
        where_clauses.append('Municipio = ?')
        params.append(municipio)
    if meses is not None and meses != "" and "Mes" in valid_cols:
        lista = [x.strip() for x in meses.split(',')]
        if lista:
            where_clauses.append('Mes IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
    if bienJuridico is not None and bienJuridico not in ("All", "") and "Bien jurídico afectado" in valid_cols:
        lista = [x.strip() for x in bienJuridico.split('|')]
        if lista:
            where_clauses.append('"Bien jurídico afectado" IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
    if tipoDelito is not None and tipoDelito not in ("All", "") and "Tipo de delito" in valid_cols:
        lista = [x.strip() for x in tipoDelito.split('|')]
        if lista:
            where_clauses.append('"Tipo de delito" IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
    if subtipoDelito is not None and subtipoDelito not in ("All", "") and "Subtipo de delito" in valid_cols:
        lista = [x.strip() for x in subtipoDelito.split('|')]
        if lista:
            where_clauses.append('"Subtipo de delito" IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
    if modalidad is not None and modalidad not in ("All", "") and "Modalidad" in valid_cols:
        lista = [x.strip() for x in modalidad.split('|')]
        if lista:
            where_clauses.append('Modalidad IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
    if sexo is not None and sexo not in ("All", "") and "Sexo" in valid_cols:
        lista = [x.strip() for x in sexo.split('|')]
        if lista:
            where_clauses.append('Sexo IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
    if rangoEdad is not None and rangoEdad not in ("All", "") and "Rango de edad" in valid_cols:
        lista = [x.strip() for x in rangoEdad.split('|')]
        if lista:
            where_clauses.append('"Rango de edad" IN (' + ','.join(['?']*len(lista)) + ')')
            params.extend(lista)
            
    if additional_clause:
        where_clauses.append(additional_clause)
        
    where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    return where_sql, params

@app.get("/api/filtros")
async def obtener_filtros(
    dataset: DatasetEnum = DatasetEnum.delitos,
    anio: Optional[int] = None,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None
):
    valid_cols = get_columns(dataset.value)
    
    def get_distinct(col, w_sql_base, params):
        if col not in valid_cols: return []
        w_sql = w_sql_base + (f' AND "{col}" IS NOT NULL' if w_sql_base else f' WHERE "{col}" IS NOT NULL')
        res = db.cursor().execute(f'SELECT DISTINCT "{col}" FROM {dataset.value} {w_sql} ORDER BY "{col}"', params).fetchall()
        return [str(r[0]) for r in res]
        
    anios_raw = get_distinct("Año", "", [])
    anios = sorted([int(a) for a in anios_raw])
    
    w_ent, p_ent = build_where(dataset, anio=anio, sexo=sexo, rangoEdad=rangoEdad)
    entidades = get_distinct("Entidad", w_ent, p_ent)
    
    w_bien, p_bien = build_where(dataset, anio=anio, sexo=sexo, rangoEdad=rangoEdad, entidad=entidad)
    bienes = get_distinct("Bien jurídico afectado", w_bien, p_bien)
    
    municipios = []
    if entidad is not None and entidad != "All" and "Municipio" in valid_cols:
        municipios = get_distinct("Municipio", w_bien, p_bien)
        
    w_tipo, p_tipo = build_where(dataset, anio=anio, sexo=sexo, rangoEdad=rangoEdad, entidad=entidad, bienJuridico=bienJuridico)
    tipos = get_distinct("Tipo de delito", w_tipo, p_tipo)
    
    w_sub, p_sub = build_where(dataset, anio=anio, sexo=sexo, rangoEdad=rangoEdad, entidad=entidad, bienJuridico=bienJuridico, tipoDelito=tipoDelito)
    subtipos = get_distinct("Subtipo de delito", w_sub, p_sub)
    
    w_mod, p_mod = build_where(dataset, anio=anio, sexo=sexo, rangoEdad=rangoEdad, entidad=entidad, bienJuridico=bienJuridico, tipoDelito=tipoDelito, subtipoDelito=subtipoDelito)
    modalidades = get_distinct("Modalidad", w_mod, p_mod)
    
    sexos = get_distinct("Sexo", "", [])
    rangos_edad = get_distinct("Rango de edad", "", [])
    
    return {
        "anios": anios,
        "entidades": entidades,
        "bienesJuridicos": bienes,
        "tiposDelito": tipos,
        "subtiposDelito": subtipos,
        "modalidades": modalidades,
        "municipios": municipios,
        "sexos": sexos,
        "rangosEdad": rangos_edad
    }

@app.get("/api/total_incidencia")
async def obtener_total_incidencia(
    dataset: DatasetEnum = DatasetEnum.delitos,
    anio: Optional[int] = None,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    municipio: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None,
    metric_type: Optional[str] = "absolute"
):
    w_sql, params = build_where(dataset, anio, entidad, meses, bienJuridico, tipoDelito, subtipoDelito, modalidad, municipio, sexo, rangoEdad)
    val_col = 'Víctimas' if 'victimas' in dataset.value else 'Incidencia'
    
    query = f'SELECT SUM("{val_col}") FROM {dataset.value} {w_sql}'
    res = db.cursor().execute(query, params).fetchone()
    total = float(res[0]) if res and res[0] is not None else 0.0
    
    if metric_type == "rate":
        pop = get_poblacion_valor(anio, entidad, municipio)
        if pop is None or pop <= 0:
            return {"total_incidencia": "N/D"}
        rate = (total / pop) * 100000
        return {"total_incidencia": round(rate, 2)}
        
    return {"total_incidencia": int(total)}

@app.get("/api/incidencia_por_entidad")
async def obtener_incidencia_por_entidad(
    dataset: DatasetEnum = DatasetEnum.delitos,
    anio: Optional[int] = None,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None,
    metric_type: Optional[str] = "absolute"
):
    w_sql, params = build_where(dataset, anio, None, meses, bienJuridico, tipoDelito, subtipoDelito, modalidad, None, sexo, rangoEdad, additional_clause="Entidad IS NOT NULL")
    val_col = 'Víctimas' if 'victimas' in dataset.value else 'Incidencia'
    
    query = f'SELECT Entidad, SUM("{val_col}") as total FROM {dataset.value} {w_sql} GROUP BY Entidad'
    df_res = db.cursor().execute(query, params).df()
    
    if df_res.empty: return []
    
    if metric_type == "rate":
        y = int(anio) if anio is not None else 2026
        try:
            pop_query = 'SELECT Entidad, Clave_Ent FROM delitos WHERE Entidad IS NOT NULL GROUP BY Entidad, Clave_Ent'
            ent_map = db.cursor().execute(pop_query).df()
            pop_res = db.cursor().execute('SELECT CLAVE_ENT, MAX(POB_MIT_ENT) as pop FROM poblacion WHERE AÑO = ? GROUP BY CLAVE_ENT', [y]).df()
            
            merged = pd.merge(ent_map, pop_res, left_on='Clave_Ent', right_on='CLAVE_ENT', how='left')
            merged['pop'] = merged['pop'].fillna(1)
            
            final = pd.merge(df_res, merged, on='Entidad', how='left')
            final['pop'] = final['pop'].fillna(1)
            final['rate_value'] = (final['total'] / final['pop']) * 100000
            
            final = final.sort_values('rate_value', ascending=False)
            final['id'] = final['rate_value'].rank(ascending=False, method='dense').astype(int)
            final['value'] = final['rate_value'].round(2)
        except Exception:
            final = df_res.copy()
            final['id'] = range(1, len(final) + 1)
            final['value'] = "N/D"
            
        final['name'] = final['Entidad'].astype(str)
        return final[['id', 'name', 'value']].to_dict('records')
    else:
        df_res = df_res.sort_values('total', ascending=False)
        df_res['id'] = df_res['total'].rank(ascending=False, method='dense').astype(int)
        df_res['value'] = df_res['total'].astype(int)
        df_res['name'] = df_res['Entidad'].astype(str)
        return df_res[['id', 'name', 'value']].to_dict('records')

@app.get("/api/incidencia_por_municipio")
async def obtener_incidencia_por_municipio(
    dataset: DatasetEnum = DatasetEnum.delitos,
    anio: Optional[int] = None,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None,
    metric_type: Optional[str] = "absolute"
):
    w_sql, params = build_where(dataset, anio, entidad, meses, bienJuridico, tipoDelito, subtipoDelito, modalidad, None, sexo, rangoEdad, additional_clause="Municipio IS NOT NULL")
    valid_cols = get_columns(dataset.value)
    if 'Municipio' not in valid_cols: return []
        
    val_col = 'Víctimas' if 'victimas' in dataset.value else 'Incidencia'
    query = f'SELECT Municipio, Entidad, SUM("{val_col}") as total FROM {dataset.value} {w_sql} GROUP BY Municipio, Entidad'
    df_res = db.cursor().execute(query, params).df()
    
    if df_res.empty: return []
    
    if metric_type == "rate":
        y = int(anio) if anio is not None else 2026
        try:
            mun_map = db.cursor().execute('SELECT Entidad, Municipio, "Cve. Municipio" FROM delitos WHERE Municipio IS NOT NULL GROUP BY Entidad, Municipio, "Cve. Municipio"').df()
            pop_res = db.cursor().execute('SELECT CLAVE, MAX(POB_MIT_MUN) as pop FROM poblacion WHERE AÑO = ? GROUP BY CLAVE', [y]).df()
            
            merged = pd.merge(mun_map, pop_res, left_on='Cve. Municipio', right_on='CLAVE', how='left')
            final = pd.merge(df_res, merged, on=['Entidad', 'Municipio'], how='left')
            final['pop'] = final['pop'].fillna(0)
            
            final['rate_value'] = final.apply(
                lambda r: (r['total'] / r['pop']) * 100000 if r['pop'] > 0 else None, axis=1
            )
            final = final.sort_values('rate_value', ascending=False, na_position='last')
            
            ranks = final['rate_value'].rank(ascending=False, method='dense')
            max_rank = int(ranks.max()) if not ranks.isna().all() else 0
            null_mask = ranks.isna()
            if null_mask.any():
                ranks[null_mask] = range(max_rank + 1, max_rank + 1 + null_mask.sum())
            final['id'] = ranks.astype(int)
            final['value'] = final['rate_value'].map(lambda x: "N/D" if pd.isna(x) else round(x, 2))
        except Exception:
            final = df_res.copy()
            final['id'] = range(1, len(final) + 1)
            final['value'] = "N/D"
    else:
        df_res = df_res.sort_values('total', ascending=False)
        df_res['id'] = df_res['total'].rank(ascending=False, method='dense').astype(int)
        df_res['value'] = df_res['total'].astype(int)
        final = df_res
        
    final['municipio'] = final['Municipio'].astype(str)
    final['entidad'] = final['Entidad'].astype(str)
    final['name'] = final['municipio'] + ', ' + final['entidad']
    return final[['id', 'municipio', 'entidad', 'name', 'value']].to_dict('records')

@app.get("/api/incidencia_por_anio")
async def obtener_incidencia_por_anio(
    dataset: DatasetEnum = DatasetEnum.delitos,
    anio: Optional[int] = None,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    municipio: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None,
    metric_type: Optional[str] = "absolute"
):
    w_sql, params = build_where(dataset, None, entidad, meses, bienJuridico, tipoDelito, subtipoDelito, modalidad, municipio, sexo, rangoEdad, additional_clause='"Año" IS NOT NULL')
    val_col = 'Víctimas' if 'victimas' in dataset.value else 'Incidencia'
    
    query = f'SELECT "Año", SUM("{val_col}") as total FROM {dataset.value} {w_sql} GROUP BY "Año" ORDER BY "Año"'
    df_res = db.cursor().execute(query, params).df()
    
    if df_res.empty: return []
    
    if metric_type == "rate":
        df_res['population'] = df_res['Año'].map(lambda y: get_poblacion_valor(y, entidad, municipio))
        df_res['rate_value'] = df_res.apply(
            lambda r: (r['total'] / r['population']) * 100000 if r['population'] > 0 else None, axis=1
        )
        df_res['value'] = df_res['rate_value'].map(lambda x: "N/D" if pd.isna(x) else round(x, 2))
    else:
        df_res['value'] = df_res['total'].astype(int)
        
    df_res['year'] = df_res['Año'].astype(int).astype(str)
    return df_res[['year', 'value']].to_dict('records')

@app.get("/api/incidencia_por_mes_historico")
async def obtener_incidencia_por_mes_historico(
    dataset: DatasetEnum = DatasetEnum.delitos,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    municipio: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None,
    metric_type: Optional[str] = "absolute"
):
    w_sql, params = build_where(dataset, None, entidad, meses, bienJuridico, tipoDelito, subtipoDelito, modalidad, municipio, sexo, rangoEdad, additional_clause='"Año" IS NOT NULL AND Mes IS NOT NULL')
    val_col = 'Víctimas' if 'victimas' in dataset.value else 'Incidencia'
    
    query = f'SELECT "Año", Mes, SUM("{val_col}") as total FROM {dataset.value} {w_sql} GROUP BY "Año", Mes'
    df_res = db.cursor().execute(query, params).df()
    
    if df_res.empty: return []
    
    mes_map = {
        'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
        'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
    }
    mes_map_rev = {v: k[:3] for k, v in mes_map.items()}
    
    df_res['Mes_Num'] = df_res['Mes'].map(mes_map)
    df_res = df_res.dropna(subset=['Mes_Num']).sort_values(['Año', 'Mes_Num'])
    
    max_year = int(df_res[df_res['total'] > 0]['Año'].max()) if not df_res[df_res['total'] > 0].empty else 9999
    max_month = int(df_res[(df_res['total'] > 0) & (df_res['Año'] == max_year)]['Mes_Num'].max()) if max_year != 9999 else 12
    
    mask = ~(
        (df_res['Año'] > max_year) |
        ((df_res['Año'] == max_year) & (df_res['Mes_Num'] > max_month))
    )
    df_res = df_res[mask]
    
    if metric_type == "rate":
        years = df_res['Año'].unique()
        pop_dict = {y: get_poblacion_valor(y, entidad, municipio) for y in years}
        df_res['population'] = df_res['Año'].map(pop_dict)
        
        df_res['rate_value'] = df_res.apply(
            lambda r: (r['total'] / r['population']) * 100000 if r['population'] > 0 else None, axis=1
        )
        df_res['value'] = df_res['rate_value'].map(lambda x: "N/D" if pd.isna(x) else round(x, 2))
    else:
        df_res['value'] = df_res['total'].astype(int)
        
    df_res['year'] = df_res['Año'].astype(int).astype(str)
    df_res['month'] = df_res['Mes_Num'].astype(int)
    df_res['name'] = df_res.apply(
        lambda r: f"{mes_map_rev.get(int(r['Mes_Num']), '')} {int(r['Año'])}", axis=1
    )
    return df_res[['name', 'year', 'month', 'value']].to_dict('records')

@app.get("/api/incidencia_por_delito")
async def obtener_incidencia_por_delito(
    categoria: str,  # "bien_juridico" | "tipo_delito" | "subtipo_delito"
    dataset: DatasetEnum = DatasetEnum.delitos,
    anio: Optional[int] = None,
    entidad: Optional[str] = None,
    meses: Optional[str] = None,
    bienJuridico: Optional[str] = None,
    tipoDelito: Optional[str] = None,
    subtipoDelito: Optional[str] = None,
    modalidad: Optional[str] = None,
    municipio: Optional[str] = None,
    sexo: Optional[str] = None,
    rangoEdad: Optional[str] = None,
    metric_type: Optional[str] = "absolute"
):
    if categoria == "bien_juridico": col = 'Bien jurídico afectado'
    elif categoria == "tipo_delito": col = 'Tipo de delito'
    elif categoria == "subtipo_delito": col = 'Subtipo de delito'
    else: return {"error": "Categoría inválida"}
    
    valid_cols = get_columns(dataset.value)
    if col not in valid_cols: return []
    
    w_sql, params = build_where(dataset, anio, entidad, meses, bienJuridico, tipoDelito, subtipoDelito, modalidad, municipio, sexo, rangoEdad, additional_clause=f'"{col}" IS NOT NULL')
    val_col = 'Víctimas' if 'victimas' in dataset.value else 'Incidencia'
    
    query = f'SELECT "{col}", SUM("{val_col}") as total FROM {dataset.value} {w_sql} GROUP BY "{col}"'
    df_res = db.cursor().execute(query, params).df()
    
    if df_res.empty: return []
    
    if metric_type == "rate":
        pop = get_poblacion_valor(anio, entidad, municipio)
        if pop is not None and pop > 0:
            df_res['rate_value'] = (df_res['total'] / pop) * 100000
            df_res = df_res.sort_values('rate_value', ascending=False)
            df_res['id'] = df_res['rate_value'].rank(ascending=False, method='dense').astype(int)
            df_res['value'] = df_res['rate_value'].round(2)
        else:
            df_res['rate_value'] = None
            df_res = df_res.sort_values('total', ascending=False)
            df_res['id'] = range(1, len(df_res) + 1)
            df_res['value'] = "N/D"
    else:
        df_res = df_res.sort_values('total', ascending=False)
        df_res['id'] = df_res['total'].rank(ascending=False, method='dense').astype(int)
        df_res['value'] = df_res['total'].astype(int)
        
    df_res['name'] = df_res[col].astype(str)
    return df_res[['id', 'name', 'value']].to_dict('records')

@app.get("/incidencia")
async def obtener_incidencia():
    inicio = time.time()
    try:
        res = db.cursor().execute("SELECT COUNT(*) FROM delitos").fetchone()
        cols = db.cursor().execute("PRAGMA table_info(delitos)").fetchall()
        count = res[0] if res else 0
        col_count = len(cols)
    except Exception:
        count = 0
        col_count = 0
    fin = time.time()
    return {
        "filas": count,
        "columnas": col_count,
        "segundos": round(fin - inicio, 2)
    }