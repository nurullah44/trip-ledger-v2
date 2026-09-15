"""The store is database-backed: configuration comes from the environment, and
data outlives the process that wrote it."""

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import ENV_VAR, Database, database_url
from app.main import create_app
from app.seed import DEMO_TOKENS, seed_if_empty
from app.store import LedgerStore
from app.tables import GroupRow

from .conftest import make_database


def test_database_url_comes_from_the_environment(monkeypatch, tmp_path) -> None:
    url = f"sqlite:///{tmp_path / 'configured.db'}"
    monkeypatch.setenv(ENV_VAR, url)

    assert database_url() == url
    assert Database().url == url
    assert str(Database().engine.url) == url


def test_default_database_is_sqlite_when_nothing_is_set(monkeypatch) -> None:
    monkeypatch.delenv(ENV_VAR, raising=False)

    assert database_url().startswith("sqlite")


def test_seeding_only_runs_once(database: Database) -> None:
    with database.session() as session:
        store = LedgerStore(session)
        assert seed_if_empty(store) is False
        assert session.scalar(select(func.count()).select_from(GroupRow)) == 3


def test_data_survives_a_restart(tmp_path) -> None:
    url = f"sqlite:///{tmp_path / 'persist.db'}"

    first = Database(url)
    first.create_all()
    with first.session() as session:
        seed_if_empty(LedgerStore(session))
    client = TestClient(create_app(first, seed=False))
    created = client.post(
        f"/groups/{DEMO_TOKENS['lisbon']['public']}/participants", json={"name": "Nadia"}
    )
    assert created.status_code == 200
    first.dispose()

    # A new engine — as after a server restart — reads what was committed.
    second = Database(url)
    reopened = TestClient(create_app(second, seed=False))
    snapshot = reopened.get(f"/groups/{DEMO_TOKENS['lisbon']['public']}").json()

    assert [p["name"] for p in snapshot["participants"]] == ["Alex", "Sam", "Maya", "Jordan", "Nadia"]
    assert len(snapshot["expenses"]) == 4
    assert len(snapshot["repayments"]) == 1


def test_create_app_seeds_the_configured_database_once(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv(ENV_VAR, f"sqlite:///{tmp_path / 'app.db'}")

    client = TestClient(create_app())
    assert client.get(f"/groups/{DEMO_TOKENS['ski']['public']}").status_code == 200

    # Restarting against the same file must not duplicate the demo data.
    restarted = TestClient(create_app())
    snapshot = restarted.get(f"/groups/{DEMO_TOKENS['lisbon']['public']}").json()
    assert len(snapshot["participants"]) == 4
    assert len(snapshot["expenses"]) == 4


def test_expenses_and_repayments_survive_a_round_trip(database: Database, client: TestClient) -> None:
    snapshot = client.get(f"/groups/{DEMO_TOKENS['lisbon']['public']}").json()
    expense_ids = {e["id"] for e in snapshot["expenses"]}

    # Fresh session, same database: the rows come back from storage, not memory.
    with database.session() as session:
        stored = LedgerStore(session).get_snapshot(DEMO_TOKENS["lisbon"]["public"])

    assert {e.id for e in stored.expenses} == expense_ids
    assert {s.participant_id for s in stored.expenses[0].splits}
    assert stored.repayments[0].payer_participant_id == "lis-jordan"


def test_other_databases_need_no_code_change() -> None:
    """A non-SQLite URL builds an engine with its own dialect; only the driver
    has to be installed (`uv sync --extra postgres`)."""
    database = Database("postgresql+psycopg://user:secret@localhost:5432/trip_ledger")

    assert database.engine.dialect.name == "postgresql"
    assert database.engine.url.database == "trip_ledger"


def test_make_database_helper_starts_empty() -> None:
    database = make_database(seed=False)

    with database.session() as session:
        assert session.scalar(select(func.count()).select_from(GroupRow)) == 0
