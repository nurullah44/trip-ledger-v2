from fastapi import APIRouter, Depends, Response

from ..auth import require_session
from ..deps import get_store
from ..models import CreateGroupRequest, CreatedGroup, GroupSnapshot
from ..store import LedgerStore

router = APIRouter(tags=["Groups"])

SNAPSHOT = {"response_model": GroupSnapshot, "response_model_exclude_none": True}


@router.post("/groups", response_model=CreatedGroup, status_code=201)
def create_group(payload: CreateGroupRequest, store: LedgerStore = Depends(get_store)) -> CreatedGroup:
    return store.create_group(payload)


@router.get("/groups/{token}", **SNAPSHOT)
def get_group(token: str, store: LedgerStore = Depends(get_store)) -> GroupSnapshot:
    return store.get_snapshot(token)


@router.delete("/groups/{token}", status_code=204)
def delete_group(
    token: str,
    store: LedgerStore = Depends(get_store),
    _user_id: str = Depends(require_session),
) -> Response:
    store.delete_group(token)
    return Response(status_code=204)


@router.post("/groups/{token}/finish", **SNAPSHOT)
def finish_group(
    token: str,
    store: LedgerStore = Depends(get_store),
    _user_id: str = Depends(require_session),
) -> GroupSnapshot:
    return store.finish_group(token)


@router.post("/groups/{token}/reopen", **SNAPSHOT)
def reopen_group(
    token: str,
    store: LedgerStore = Depends(get_store),
    _user_id: str = Depends(require_session),
) -> GroupSnapshot:
    return store.reopen_group(token)
