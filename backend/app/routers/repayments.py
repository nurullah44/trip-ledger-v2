from fastapi import APIRouter, Depends

from ..deps import get_store
from ..models import GroupSnapshot, RepaymentRequest
from ..store import LedgerStore

router = APIRouter(tags=["Repayments"])

SNAPSHOT = {"response_model": GroupSnapshot, "response_model_exclude_none": True}


@router.post("/groups/{token}/repayments", status_code=201, **SNAPSHOT)
def create_repayment(
    token: str,
    payload: RepaymentRequest,
    store: LedgerStore = Depends(get_store),
) -> GroupSnapshot:
    return store.create_repayment(token, payload)
