from fastapi import APIRouter, Depends

from ..deps import get_store
from ..models import LoginRequest, Session
from ..store import LedgerStore

router = APIRouter(tags=["Auth"])


@router.post("/auth/login", response_model=Session)
def login(payload: LoginRequest, store: LedgerStore = Depends(get_store)) -> Session:
    return store.login(payload.username, payload.password)
