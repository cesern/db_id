"""Ranking nacional de municipios: total clasificado, empates, exclusiones y relleno con ceros."""

RK = "/api/ranking_historico"
BASE = {"dataset": "delitos", "nivel": "municipio", "temporalidad": "anual"}


def _serie(c, nombre, **extra):
    filas = c.get(RK, params={**BASE, "municipios_sonora": nombre.split(",")[0], **extra}).json()
    return [f for f in filas if f["name"] == nombre]


def test_lugar_coincide_con_la_tabla_nacional(make_client):
    c = make_client({})
    punto = next(f for f in _serie(c, "Cajeme, Sonora") if f["period"] == "2025")
    tabla = c.get("/api/incidencia_por_municipio", params={"dataset": "delitos", "anio": 2025}).json()
    reales = [m for m in tabla if m["municipio"] not in ("No especificado", "Otros Municipios")]
    cajeme = next(m for m in reales if m["name"] == "Cajeme, Sonora")
    assert punto["total"] == cajeme["value"]
    assert punto["rank"] == 1 + sum(1 for m in reales if m["value"] > cajeme["value"])
    assert punto["n"] == len(reales)


def test_n_es_igual_en_todo_el_periodo_y_empatados_minimo_uno(make_client):
    c = make_client({})
    filas = c.get(RK, params=BASE).json()
    por_periodo = {}
    for f in filas:
        por_periodo.setdefault(f["period"], set()).add(f["n"])
        assert f["empatados"] >= 1
    assert all(len(v) == 1 for v in por_periodo.values())


def test_no_municipios_fuera_del_ranking(make_client):
    c = make_client({})
    nombres = {f["name"].split(",")[0] for f in c.get(RK, params=BASE).json()}
    assert "No especificado" not in nombres
    assert "Otros Municipios" not in nombres


def test_municipio_con_acento(make_client):
    c = make_client({})
    serie = _serie(c, "Álamos, Sonora")
    assert [f["period"] for f in serie][0] == "2015"
    assert serie[-1]["period"] == "2026"


def test_victimas_mun_rellena_con_cero_y_marca_empate(make_client):
    c = make_client({})
    vm = {"dataset": "victimas_mun", "nivel": "municipio", "temporalidad": "mensual"}
    sin_filtro = c.get(RK, params=vm).json()
    feminicidio = c.get(RK, params={**vm, "subtipoDelito": "Feminicidio"}).json()
    n_base = {f["period"]: f["n"] for f in sin_filtro}
    n_fem = {f["period"]: f["n"] for f in feminicidio}
    assert n_fem == n_base                       # mismos municipios clasificados con o sin filtro
    en_cero = [f for f in feminicidio if f["name"].endswith(", Sonora") and f["total"] == 0]
    assert en_cero and all(f["empatados"] >= 10 for f in en_cero)


def test_mensual_no_pasa_del_ultimo_mes_publicado(make_client):
    c = make_client({})
    anios = c.get("/api/incidencia_por_anio", params={"dataset": "victimas_mun"}).json()
    mes_final = next(a["mes_final"] for a in anios if a["year"] == "2026")
    filas = c.get(RK, params={"dataset": "victimas_mun", "nivel": "municipio", "temporalidad": "mensual"}).json()
    assert max(f["period"] for f in filas) == f"2026-{mes_final:02d}"


def test_entidad_conserva_rank_y_total(make_client):
    c = make_client({})
    filas = c.get(RK, params={"dataset": "delitos", "nivel": "entidad", "temporalidad": "anual"}).json()
    sonora = next(f for f in filas if f["name"] == "Sonora" and f["period"] == "2025")
    tabla = c.get("/api/incidencia_por_entidad", params={"dataset": "delitos", "anio": 2025}).json()
    ref = next(e for e in tabla if e["name"] == "Sonora")
    assert (sonora["rank"], sonora["total"]) == (ref["id"], ref["value"])
    assert sonora["n"] == 32
