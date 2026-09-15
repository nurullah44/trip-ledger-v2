import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.seed import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, DEMO_TOKENS, seed_demo_data
from app.store import LedgerStore


@pytest.fixture()
def store() -> LedgerStore:
    """A fresh, seeded store per test — the API never touches a shared process store."""
    return seed_demo_data(LedgerStore())


@pytest.fixture()
def client(store: LedgerStore) -> TestClient:
    return TestClient(create_app(store))


@pytest.fixture()
def bearer(client: TestClient) -> str:
    response = client.post(
        "/auth/login",
        json={"username": DEFAULT_ADMIN_USERNAME, "password": DEFAULT_ADMIN_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["accessToken"]


@pytest.fixture()
def auth_headers(bearer: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {bearer}"}


@pytest.fixture()
def lisbon_public() -> str:
    return DEMO_TOKENS["lisbon"]["public"]


@pytest.fixture()
def lisbon_admin() -> str:
    return DEMO_TOKENS["lisbon"]["admin"]
