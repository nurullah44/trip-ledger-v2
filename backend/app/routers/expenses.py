from fastapi import APIRouter, Depends

from ..deps import get_store
from ..models import ExpenseRequest, GroupSnapshot
from ..store import LedgerStore

router = APIRouter(tags=["Expenses"])

SNAPSHOT = {"response_model": GroupSnapshot, "response_model_exclude_none": True}


@router.post("/groups/{token}/expenses", status_code=201, **SNAPSHOT)
def create_expense(
    token: str,
    payload: ExpenseRequest,
    store: LedgerStore = Depends(get_store),
) -> GroupSnapshot:
    return store.create_expense(token, payload)


@router.put("/groups/{token}/expenses/{expense_id}", **SNAPSHOT)
def update_expense(
    token: str,
    expense_id: str,
    payload: ExpenseRequest,
    store: LedgerStore = Depends(get_store),
) -> GroupSnapshot:
    return store.update_expense(token, expense_id, payload)


@router.delete("/groups/{token}/expenses/{expense_id}", **SNAPSHOT)
def delete_expense(
    token: str,
    expense_id: str,
    store: LedgerStore = Depends(get_store),
) -> GroupSnapshot:
    return store.delete_expense(token, expense_id)
