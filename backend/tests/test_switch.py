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
