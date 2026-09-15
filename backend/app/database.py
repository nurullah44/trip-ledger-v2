"""Engine and session handling, driven by `TRIP_LEDGER_DATABASE_URL`.

The URL is the only thing that ties the app to a database, so swapping SQLite
for Postgres (or anything else SQLAlchemy speaks) is an environment change plus
the matching driver, not a code change:

    TRIP_LEDGER_DATABASE_URL=sqlite:///./trip-ledger.db                    # default
    TRIP_LEDGER_DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db   # uv sync --extra postgres
"""

import os
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .tables import Base

ENV_VAR = "TRIP_LEDGER_DATABASE_URL"
DEFAULT_DATABASE_URL = "sqlite:///./trip-ledger.db"


def database_url() -> str:
    """The database the server should connect to, from the environment."""
    return os.environ.get(ENV_VAR) or DEFAULT_DATABASE_URL


def _engine_kwargs(url: str) -> dict:
    if not url.startswith("sqlite"):
        return {}
    kwargs: dict = {"connect_args": {"check_same_thread": False}}
    if ":memory:" in url or url.endswith("sqlite://"):
        # One shared connection, so an in-memory database survives across sessions.
        kwargs["poolclass"] = StaticPool
    return kwargs


def _enable_sqlite_foreign_keys(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_connection, _record):  # pragma: no cover - driver callback
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Database:
    """Owns the engine and hands out sessions (one per request)."""

    def __init__(self, url: str | None = None) -> None:
        self.url = url or database_url()
        self.engine = create_engine(self.url, **_engine_kwargs(self.url))
        if self.url.startswith("sqlite"):
            _enable_sqlite_foreign_keys(self.engine)
        self._session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    def drop_all(self) -> None:
        Base.metadata.drop_all(self.engine)

    @contextmanager
    def session(self) -> Iterator[Session]:
        """One unit of work: commit on success, roll back on any exception."""
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def dispose(self) -> None:
        self.engine.dispose()
