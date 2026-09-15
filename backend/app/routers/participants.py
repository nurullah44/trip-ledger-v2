from fastapi import APIRouter, Depends

from ..deps import get_store
from ..models import GroupSnapshot, ParticipantNameRequest
from ..store import LedgerStore

router = APIRouter(tags=["Participants"])

SNAPSHOT = {"response_model": GroupSnapshot, "response_model_exclude_none": True}


@router.post("/groups/{token}/participants", **SNAPSHOT)
def add_participant(
    token: str,
    payload: ParticipantNameRequest,
    store: LedgerStore = Depends(get_store),
) -> GroupSnapshot:
    return store.add_participant(token, payload.name)


@router.patch("/groups/{token}/participants/{participant_id}", **SNAPSHOT)
def rename_participant(
    token: str,
    participant_id: str,
    payload: ParticipantNameRequest,
    store: LedgerStore = Depends(get_store),
) -> GroupSnapshot:
    return store.rename_participant(token, participant_id, payload.name)
