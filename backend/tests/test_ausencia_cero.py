"""Ausencia de fila = cero, solo en periodos ya publicados.

`victimas_mun` no trae filas en cero: un municipio sin víctimas de un delito no aparece para ese
delito (Sonora, Homicidio doloso: 30 de 73). El tablero debe listar a todos con 0 en los meses
publicados y no inventar ceros en los meses que la fuente aún no publica.

Usa los Parquet semilla del repositorio.
"""

MUN = "/api/incidencia_por_municipio"
BASE = {"dataset": "victimas_mun", "anio": 2026, "entidad": "Sonora"}
HOMICIDIO = {**BASE, "subtipoDelito": "Homicidio doloso"}


def test_municipios_completos_con_filtro_de_delito(make_client):
    c = make_client({})
    todos = c.get(MUN, params=BASE).json()
    filtrado = c.get(MUN, params=HOMICIDIO).json()

    assert len(todos) > 30
    # Mismos municipios con o sin filtro; los que no tienen filas del delito valen 0
    assert {r["municipio"] for r in filtrado} == {r["municipio"] for r in todos}
    assert sum(1 for r in filtrado if r["value"] == 0) > 0
    assert all(isinstance(r["value"], int) for r in filtrado)
    # El relleno no cambia el total
    total = c.get("/api/total_incidencia", params=HOMICIDIO).json()["total_incidencia"]
    assert sum(r["value"] for r in filtrado) == total


def test_tasa_tambien_lista_a_todos(make_client):
    c = make_client({})
    todos = c.get(MUN, params=BASE).json()
    tasa = c.get(MUN, params={**HOMICIDIO, "metric_type": "rate"}).json()
    assert {r["municipio"] for r in tasa} == {r["municipio"] for r in todos}


def test_meses_sin_publicar_no_se_rellenan(make_client):
    c = make_client({})
    # Diciembre de 2026 aún no existe en la fuente: no se inventan ceros
    dic = c.get(MUN, params={**HOMICIDIO, "meses": "Diciembre"}).json()
    publicado = c.get(MUN, params={**HOMICIDIO, "meses": "Enero"}).json()
    assert len(dic) < len(publicado)


def test_serie_mensual_de_municipio_sin_filas(make_client):
    c = make_client({})
    filtrado = c.get(MUN, params=HOMICIDIO).json()
    sin_casos = next(r["municipio"] for r in filtrado if r["value"] == 0 and r["municipio"] != "No especificado")

    serie = c.get("/api/incidencia_por_mes_historico",
                  params={"dataset": "victimas_mun", "entidad": "Sonora", "municipio": sin_casos,
                          "subtipoDelito": "Homicidio doloso"}).json()
    anios = c.get("/api/incidencia_por_anio", params={"dataset": "victimas_mun"}).json()
    mes_final = next(a["mes_final"] for a in anios if a["year"] == "2026")

    # Un cero por cada mes publicado, y ninguno después
    assert [p["month"] for p in serie] == list(range(1, mes_final + 1))
    assert all(p["value"] == 0 for p in serie)


def test_delitos_no_cambia(make_client):
    c = make_client({})
    d = {"dataset": "delitos", "anio": 2026, "entidad": "Sonora"}
    assert len(c.get(MUN, params={**d, "subtipoDelito": "Homicidio doloso"}).json()) == len(c.get(MUN, params=d).json())
    # Alto impacto sin delitos activos sigue devolviendo vacío (vacío = vacío)
    assert c.get(MUN, params={**d, "altoImpacto": ""}).json() == []
