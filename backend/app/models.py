"""Pydantic models that mirror openapi.yaml exactly.

Field names are snake_case in Python and camelCase in JSON (the API contract),
via the alias generator on `APIModel`.
"""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

CurrencyCode = Literal["USD", "EUR", "TRY", "GBP", "JPY"]
GroupStatus = Literal["active", "finished"]
AccessLevel = Literal["public", "admin"]
SplitMethod = Literal["equal", "custom"]
LedgerErrorCode = Literal[
    "validation",
    "unauthorized",
    "forbidden",
    "not_found",
    "conflict",
    "group_locked",
]

NonEmptyStr = Annotated[str, Field(min_length=1)]
PositiveMinorUnits = Annotated[int, Field(ge=1)]
NonNegativeMinorUnits = Annotated[int, Field(ge=0)]


class APIModel(BaseModel):
    """Camel-cased JSON, strict about unknown fields (contract: additionalProperties: false)."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


# --------------------------------------------------------------------------- #
# Domain
# --------------------------------------------------------------------------- #


class Group(APIModel):
    id: str
    name: str
    currency: CurrencyCode
    status: GroupStatus
    created_at: datetime
    updated_at: datetime


class Participant(APIModel):
    id: str
    group_id: str
    name: str
    created_at: datetime


class ExpenseSplit(APIModel):
    participant_id: str
    amount: NonNegativeMinorUnits


class Expense(APIModel):
    id: str
    group_id: str
    description: str
    amount: PositiveMinorUnits
    paid_by_participant_id: str
    expense_date: date
    split_method: SplitMethod
    splits: list[ExpenseSplit]
    created_at: datetime
    updated_at: datetime


class Repayment(APIModel):
    id: str
    group_id: str
    payer_participant_id: str
    recipient_participant_id: str
    amount: PositiveMinorUnits
    payment_date: date
    created_at: datetime


class GroupSnapshot(APIModel):
    group: Group
    access: AccessLevel
    participants: list[Participant]
    expenses: list[Expense]
    repayments: list[Repayment]
    public_token: str
    admin_token: str | None = None


class CreatedGroup(APIModel):
    group: Group
    public_token: str
    admin_token: str


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #


class CreateGroupRequest(APIModel):
    name: NonEmptyStr
    currency: CurrencyCode
    participant_names: list[str] = Field(min_length=2)


class ParticipantNameRequest(APIModel):
    name: NonEmptyStr


class ExpenseRequest(APIModel):
    description: NonEmptyStr
    amount: PositiveMinorUnits
    paid_by_participant_id: NonEmptyStr
    expense_date: date
    split_method: SplitMethod
    splits: list[ExpenseSplit] = Field(min_length=1)


class RepaymentRequest(APIModel):
    payer_participant_id: NonEmptyStr
    recipient_participant_id: NonEmptyStr
    amount: PositiveMinorUnits
    payment_date: date


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #


class LoginRequest(APIModel):
    username: NonEmptyStr
    password: NonEmptyStr


class Session(APIModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime


class LedgerErrorBody(APIModel):
    code: LedgerErrorCode
    message: str
