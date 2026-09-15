"""The ledger store: one unit of work over a SQLAlchemy session.

Routers only ever talk to this class, so the datastore behind it stayed
swappable: it began as dicts in memory and is now tables that work on any
database SQLAlchemy supports. Validation messages and error codes are part of
the API contract and are unchanged.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Callable

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .auth import (
    hash_password,
    hash_session_token,
    new_session,
    new_session_token,
    session_expiry,
    utcnow,
    verify_password,
)
from .errors import LedgerError
from .models import (
    AccessLevel,
    CreateGroupRequest,
    CreatedGroup,
    Expense,
    ExpenseRequest,
    ExpenseSplit,
    Group,
    GroupSnapshot,
    Participant,
    Repayment,
    RepaymentRequest,
    Session as SessionModel,
)
from .tables import (
    ExpenseRow,
    GroupRow,
    ParticipantRow,
    RepaymentRow,
    SessionRow,
    SplitRow,
    UserRow,
)

ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


def _code(length: int) -> str:
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(length))


def _utc(value: datetime) -> datetime:
    """SQLite drops tzinfo; the API contract promises UTC timestamps."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Seed structures (used by app/seed.py)
# --------------------------------------------------------------------------- #


@dataclass
class SeedParticipant:
    id: str
    name: str


@dataclass
class SeedExpense:
    id: str
    description: str
    amount: int
    paid_by_participant_id: str
    expense_date: date
    split_method: str
    splits: list[tuple[str, int]]
    created_at: datetime


@dataclass
class SeedRepayment:
    id: str
    payer_participant_id: str
    recipient_participant_id: str
    amount: int
    payment_date: date
    created_at: datetime


@dataclass
class GroupSeed:
    id: str
    name: str
    currency: str
    status: str
    created_at: datetime
    updated_at: datetime
    public_token: str
    admin_token: str
    participants: list[SeedParticipant] = field(default_factory=list)
    expenses: list[SeedExpense] = field(default_factory=list)
    repayments: list[SeedRepayment] = field(default_factory=list)


class LedgerStore:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ------------------------------------------------------------------ #
    # Users and sessions
    # ------------------------------------------------------------------ #

    def create_user(self, username: str, password: str) -> UserRow:
        key = username.strip().lower()
        user = self.session.scalar(select(UserRow).where(UserRow.username == key))
        if user is None:
            user = UserRow(id=_code(16), username=key, password_hash="")
            self.session.add(user)
        user.password_hash = hash_password(password)
        self.session.flush()
        return user

    def password_hash_for(self, username: str) -> str | None:
        user = self.session.scalar(select(UserRow).where(UserRow.username == username.strip().lower()))
        return user.password_hash if user else None

    def login(self, username: str, password: str) -> SessionModel:
        user = self.session.scalar(select(UserRow).where(UserRow.username == username.strip().lower()))
        if user is None or not verify_password(password, user.password_hash):
            raise LedgerError("unauthorized", "Wrong username or password.")
        token = new_session_token()
        expires_at = session_expiry(utcnow())
        self.session.add(
            SessionRow(token_hash=hash_session_token(token), user_id=user.id, expires_at=expires_at)
        )
        self.session.flush()
        return new_session(token, expires_at)

    def resolve_session(self, token: str) -> str:
        """Return the user id behind a bearer token, or raise 401."""
        digest = hash_session_token(token)
        row = self.session.get(SessionRow, digest)
        if row is None:
            raise LedgerError("unauthorized", "Sign in again to continue.")
        if _utc(row.expires_at) <= utcnow():
            self.session.delete(row)
            raise LedgerError("unauthorized", "Sign in again to continue.")
        return row.user_id

    # ------------------------------------------------------------------ #
    # Reading
    # ------------------------------------------------------------------ #

    def _resolve(self, token: str) -> tuple[GroupRow, AccessLevel]:
        row = self.session.scalar(
            select(GroupRow).where(
                or_(GroupRow.public_token == token, GroupRow.admin_token == token)
            )
        )
        if row is None:
            raise LedgerError("not_found", "This group link is not valid.")
        access: AccessLevel = "admin" if row.admin_token == token else "public"
        return row, access

    def _snapshot(self, row: GroupRow, access: AccessLevel) -> GroupSnapshot:
        expenses = sorted(row.expenses, key=lambda e: (e.expense_date, e.created_at), reverse=True)
        repayments = sorted(
            row.repayments, key=lambda r: (r.payment_date, r.created_at), reverse=True
        )
        snapshot = GroupSnapshot(
            group=Group(
                id=row.id,
                name=row.name,
                currency=row.currency,
                status=row.status,
                created_at=_utc(row.created_at),
                updated_at=_utc(row.updated_at),
            ),
            access=access,
            participants=[
                Participant(
                    id=p.id, group_id=p.group_id, name=p.name, created_at=_utc(p.created_at)
                )
                for p in row.participants
            ],
            expenses=[
                Expense(
                    id=e.id,
                    group_id=e.group_id,
                    description=e.description,
                    amount=e.amount,
                    paid_by_participant_id=e.paid_by_participant_id,
                    expense_date=e.expense_date,
                    split_method=e.split_method,
                    splits=[
                        ExpenseSplit(participant_id=s.participant_id, amount=s.amount)
                        for s in e.splits
                    ],
                    created_at=_utc(e.created_at),
                    updated_at=_utc(e.updated_at),
                )
                for e in expenses
            ],
            repayments=[
                Repayment(
                    id=r.id,
                    group_id=r.group_id,
                    payer_participant_id=r.payer_participant_id,
                    recipient_participant_id=r.recipient_participant_id,
                    amount=r.amount,
                    payment_date=r.payment_date,
                    created_at=_utc(r.created_at),
                )
                for r in repayments
            ],
            public_token=row.public_token,
        )
        if access == "admin":
            snapshot.admin_token = row.admin_token
        return snapshot

    def get_snapshot(self, token: str) -> GroupSnapshot:
        row, access = self._resolve(token)
        return self._snapshot(row, access)

    # ------------------------------------------------------------------ #
    # Groups
    # ------------------------------------------------------------------ #

    def _unique_token(self, length: int, column: str) -> str:
        while True:
            token = _code(length)
            taken = self.session.scalar(
                select(func.count()).select_from(GroupRow).where(getattr(GroupRow, column) == token)
            )
            if not taken:
                return token

    def create_group(self, payload: CreateGroupRequest) -> CreatedGroup:
        name = payload.name.strip()
        if not name:
            raise LedgerError("validation", "Give the group a name.")
        names = [raw.strip() for raw in payload.participant_names if raw.strip()]
        if len(names) < 2:
            raise LedgerError("validation", "Add at least two people.")

        now = utcnow()
        group_id = _code(16)
        row = GroupRow(
            id=group_id,
            name=name,
            currency=payload.currency,
            status="active",
            created_at=now,
            updated_at=now,
            public_token=self._unique_token(32, "public_token"),
            admin_token=self._unique_token(40, "admin_token"),
        )
        for position, participant_name in enumerate(names):
            row.participants.append(
                ParticipantRow(
                    id=_code(16),
                    group_id=group_id,
                    name=participant_name,
                    position=position,
                    created_at=now,
                )
            )
        self.session.add(row)
        self.session.flush()
        return CreatedGroup(
            group=Group(
                id=row.id,
                name=row.name,
                currency=row.currency,
                status=row.status,
                created_at=_utc(row.created_at),
                updated_at=_utc(row.updated_at),
            ),
            public_token=row.public_token,
            admin_token=row.admin_token,
        )

    def insert_seed_group(self, seed: GroupSeed) -> None:
        """Install a fully-formed group (used by the demo seed only)."""
        row = GroupRow(
            id=seed.id,
            name=seed.name,
            currency=seed.currency,
            status=seed.status,
            created_at=seed.created_at,
            updated_at=seed.updated_at,
            public_token=seed.public_token,
            admin_token=seed.admin_token,
        )
        for position, participant in enumerate(seed.participants):
            row.participants.append(
                ParticipantRow(
                    id=participant.id,
                    group_id=seed.id,
                    name=participant.name,
                    position=position,
                    created_at=seed.created_at,
                )
            )
        for expense in seed.expenses:
            row.expenses.append(
                ExpenseRow(
                    id=expense.id,
                    group_id=seed.id,
                    description=expense.description,
                    amount=expense.amount,
                    paid_by_participant_id=expense.paid_by_participant_id,
                    expense_date=expense.expense_date,
                    split_method=expense.split_method,
                    created_at=expense.created_at,
                    updated_at=expense.created_at,
                    splits=[
                        SplitRow(participant_id=participant_id, amount=amount)
                        for participant_id, amount in expense.splits
                    ],
                )
            )
        for repayment in seed.repayments:
            row.repayments.append(
                RepaymentRow(
                    id=repayment.id,
                    group_id=seed.id,
                    payer_participant_id=repayment.payer_participant_id,
                    recipient_participant_id=repayment.recipient_participant_id,
                    amount=repayment.amount,
                    payment_date=repayment.payment_date,
                    created_at=repayment.created_at,
                )
            )
        self.session.add(row)
        self.session.flush()

    def delete_group(self, token: str) -> None:
        row, access = self._resolve(token)
        if access != "admin":
            raise LedgerError("forbidden", "Only the group admin can delete the group.")
        self.session.delete(row)

    @staticmethod
    def _assert_active(row: GroupRow) -> None:
        if row.status == "finished":
            raise LedgerError("group_locked", "This group is finished. Reopen it to make changes.")

    def _mutate(
        self,
        token: str,
        apply: Callable[[GroupRow], None],
        *,
        admin_only: bool = False,
        allow_finished: bool = False,
    ) -> GroupSnapshot:
        row, access = self._resolve(token)
        if admin_only and access != "admin":
            raise LedgerError("forbidden", "Only the group admin can do this.")
        if not allow_finished:
            self._assert_active(row)
        apply(row)
        row.updated_at = utcnow()
        self.session.flush()
        return self._snapshot(row, access)

    def finish_group(self, token: str) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            row.status = "finished"

        return self._mutate(token, apply, admin_only=True)

    def reopen_group(self, token: str) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            row.status = "active"

        return self._mutate(token, apply, admin_only=True, allow_finished=True)

    # ------------------------------------------------------------------ #
    # Participants
    # ------------------------------------------------------------------ #

    def add_participant(self, token: str, name: str) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            clean = name.strip()
            if not clean:
                raise LedgerError("validation", "Enter a name.")
            if any(p.name.lower() == clean.lower() for p in row.participants):
                raise LedgerError("conflict", "Someone with that name is already in the group.")
            last = self.session.scalar(
                select(func.coalesce(func.max(ParticipantRow.position), -1)).where(
                    ParticipantRow.group_id == row.id
                )
            )
            row.participants.append(
                ParticipantRow(
                    id=_code(16),
                    group_id=row.id,
                    name=clean,
                    position=int(last) + 1,
                    created_at=utcnow(),
                )
            )

        return self._mutate(token, apply)

    def rename_participant(self, token: str, participant_id: str, name: str) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            clean = name.strip()
            if not clean:
                raise LedgerError("validation", "Enter a name.")
            participant = next((p for p in row.participants if p.id == participant_id), None)
            if participant is None:
                raise LedgerError("not_found", "That person is not in this group.")
            if any(p.id != participant_id and p.name.lower() == clean.lower() for p in row.participants):
                raise LedgerError("conflict", "Someone with that name is already in the group.")
            participant.name = clean

        return self._mutate(token, apply)

    # ------------------------------------------------------------------ #
    # Expenses and repayments
    # ------------------------------------------------------------------ #

    @staticmethod
    def _validate_expense(row: GroupRow, payload: ExpenseRequest) -> None:
        if not payload.description.strip():
            raise LedgerError("validation", "Add a short description.")
        ids = {p.id for p in row.participants}
        if payload.paid_by_participant_id not in ids:
            raise LedgerError("validation", "Choose who paid.")
        seen: set[str] = set()
        for split in payload.splits:
            if split.participant_id not in ids:
                raise LedgerError("validation", "Everyone included must be in this group.")
            if split.participant_id in seen:
                raise LedgerError("validation", "Someone is included twice.")
            seen.add(split.participant_id)
        if sum(split.amount for split in payload.splits) != payload.amount:
            raise LedgerError("validation", "The split amounts must add up to the total.")

    @staticmethod
    def _validate_repayment(row: GroupRow, payload: RepaymentRequest) -> None:
        if payload.payer_participant_id == payload.recipient_participant_id:
            raise LedgerError("validation", "Payer and recipient must be different people.")
        ids = {p.id for p in row.participants}
        if payload.payer_participant_id not in ids or payload.recipient_participant_id not in ids:
            raise LedgerError("validation", "Both people must be in this group.")

    def create_expense(self, token: str, payload: ExpenseRequest) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            self._validate_expense(row, payload)
            now = utcnow()
            row.expenses.append(
                ExpenseRow(
                    id=_code(16),
                    group_id=row.id,
                    description=payload.description.strip(),
                    amount=payload.amount,
                    paid_by_participant_id=payload.paid_by_participant_id,
                    expense_date=payload.expense_date,
                    split_method=payload.split_method,
                    created_at=now,
                    updated_at=now,
                    splits=[
                        SplitRow(participant_id=s.participant_id, amount=s.amount)
                        for s in payload.splits
                    ],
                )
            )

        return self._mutate(token, apply)

    def update_expense(self, token: str, expense_id: str, payload: ExpenseRequest) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            expense = next((e for e in row.expenses if e.id == expense_id), None)
            if expense is None:
                raise LedgerError("not_found", "That expense no longer exists.")
            self._validate_expense(row, payload)
            expense.description = payload.description.strip()
            expense.amount = payload.amount
            expense.paid_by_participant_id = payload.paid_by_participant_id
            expense.expense_date = payload.expense_date
            expense.split_method = payload.split_method
            expense.splits = [
                SplitRow(participant_id=s.participant_id, amount=s.amount) for s in payload.splits
            ]
            expense.updated_at = utcnow()

        return self._mutate(token, apply)

    def delete_expense(self, token: str, expense_id: str) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            expense = next((e for e in row.expenses if e.id == expense_id), None)
            if expense is None:
                raise LedgerError("not_found", "That expense no longer exists.")
            row.expenses.remove(expense)

        return self._mutate(token, apply)

    def create_repayment(self, token: str, payload: RepaymentRequest) -> GroupSnapshot:
        def apply(row: GroupRow) -> None:
            self._validate_repayment(row, payload)
            row.repayments.append(
                RepaymentRow(
                    id=_code(16),
                    group_id=row.id,
                    payer_participant_id=payload.payer_participant_id,
                    recipient_participant_id=payload.recipient_participant_id,
                    amount=payload.amount,
                    payment_date=payload.payment_date,
                    created_at=utcnow(),
                )
            )

        return self._mutate(token, apply)
