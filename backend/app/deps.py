"""Per-request wiring: one database session, one store, one auth check."""

from collections.abc import Iterator

from fastapi import Depends, Request

from .auth import bearer_token
from .database import Database
from .store import LedgerStore


def get_database(request: Request) -> Database:
    return request.app.state.db


def get_store(request: Request) -> Iterator[LedgerStore]:
    """One session per request; committed when the request succeeds."""
    database: Database = request.app.state.db
    with database.session() as session:
        yield LedgerStore(session)


def require_session(
    request: Request,
    store: LedgerStore = Depends(get_store),
) -> str:
    """FastAPI dependency: returns the authenticated user id or raises 401."""
    return store.resolve_session(bearer_token(request))
