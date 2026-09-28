"""Interruptor del admin: apagado por defecto."""


def test_admin_off_by_default(make_client):
    c = make_client({})
    assert c.post("/api/admin/login", json={"username": "a", "password": "b"}).status_code == 404


def test_public_cors_without_credentials_when_admin_off(make_client):
    c = make_client({})
    r = c.get("/api/filtros", headers={"Origin": "https://evil.example"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in r.headers


def test_empty_enable_admin_counts_as_off(make_client):
    c = make_client({"ENABLE_ADMIN": ""})
    assert c.post("/api/admin/login", json={"username": "a", "password": "b"}).status_code == 404


def test_mes_final_no_depende_de_los_filtros(make_client):
    # Un delito poco frecuente con 0 casos en diciembre no debe marcar años completos como parciales:
    # "hasta qué mes hay datos" sale del conjunto completo, no de los filtros
    c = make_client({})
    todos = {r["year"]: r["mes_final"] for r in c.get("/api/incidencia_por_anio", params={"dataset": "delitos", "entidad": "Sonora"}).json()}
    filtrado = c.get("/api/incidencia_por_anio", params={"dataset": "delitos", "entidad": "Sonora", "subtipoDelito": "Feminicidio"}).json()
    assert filtrado
    for r in filtrado:
        assert r["mes_final"] == todos[r["year"]]
