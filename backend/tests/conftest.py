import pytest
from fastapi.testclient import TestClient

from app.database import Database
from app.main import create_app
from app.seed import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, DEMO_TOKENS, seed_demo_data
from app.store import LedgerStore


def make_database(url: str = "sqlite://", *, seed: bool = True) -> Database:
    """An isolated database (in memory unless a URL is given), tables created."""
    database = Database(url)
    database.create_all()
    if seed:
        with database.session() as session:
            seed_demo_data(LedgerStore(session))
    return database


@pytest.fixture()
def database() -> Database:
    return make_database()


@pytest.fixture()
def client(database: Database) -> TestClient:
    # Already seeded above, so the app must not seed again.
    return TestClient(create_app(database, seed=False))


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


@pytest.fixture()
def store(database: Database):
    """A store bound to its own session, for direct store-level assertions."""
    with database.session() as session:
        yield LedgerStore(session)
