from fastapi import Request

from .store import LedgerStore


def get_store(request: Request) -> LedgerStore:
    """The process-wide in-memory store, attached in `create_app`."""
    return request.app.state.store
