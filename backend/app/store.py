"""In-memory ledger store: the whole database lives in dicts guarded by a lock.

Behaviour (validation messages, token kinds, locking, ordering) mirrors the
frontend's mock service (`frontend/src/services/mock-ledger-service.ts`) so the
UI sees the same ledger either way.
"""

from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

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
    Group,
    GroupSnapshot,
    Participant,
    Repayment,
    RepaymentRequest,
    Session,
)

ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


def _code(length: int) -> str:
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(length))


@dataclass
class GroupRecord:
    group: Group
    public_token: str
    admin_token: str
    participants: list[Participant]
    expenses: list[Expense]
    repayments: list[Repayment]


@dataclass
class UserRecord:
    id: str
    username: str
    password_hash: str


@dataclass
class SessionRecord:
    user_id: str
    expires_at: datetime


class LedgerStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._groups: dict[str, GroupRecord] = {}
        self._tokens: dict[str, str] = {}
        self._users: dict[str, UserRecord] = {}
        self._sessions: dict[str, SessionRecord] = {}

    # ------------------------------------------------------------------ #
    # Users and sessions
    # ------------------------------------------------------------------ #

    def create_user(self, username: str, password: str) -> UserRecord:
        with self._lock:
            record = UserRecord(id=_code(16), username=username, password_hash=hash_password(password))
            self._users[username.strip().lower()] = record
            return record

    def password_hash_for(self, username: str) -> str | None:
        record = self._users.get(username.strip().lower())
        return record.password_hash if record else None

    def login(self, username: str, password: str) -> Session:
        with self._lock:
            user = self._users.get(username.strip().lower())
            if user is None or not verify_password(password, user.password_hash):
                raise LedgerError("unauthorized", "Wrong username or password.")
            token = new_session_token()
            expires_at = session_expiry(utcnow())
            self._sessions[hash_session_token(token)] = SessionRecord(user_id=user.id, expires_at=expires_at)
            return new_session(token, expires_at)

    def resolve_session(self, token: str) -> str:
        """Return the user id behind a bearer token, or raise 401."""
        digest = hash_session_token(token)
        with self._lock:
            record = self._sessions.get(digest)
            if record is None:
                raise LedgerError("unauthorized", "Sign in again to continue.")
            if record.expires_at <= utcnow():
                del self._sessions[digest]
                raise LedgerError("unauthorized", "Sign in again to continue.")
            return record.user_id

    # ------------------------------------------------------------------ #
    # Reading
    # ------------------------------------------------------------------ #

    def _resolve(self, token: str) -> tuple[GroupRecord, AccessLevel]:
        group_id = self._tokens.get(token)
        record = self._groups.get(group_id) if group_id else None
        if record is None:
            raise LedgerError("not_found", "This group link is not valid.")
        access: AccessLevel = "admin" if record.admin_token == token else "public"
        return record, access

    def _snapshot(self, record: GroupRecord, access: AccessLevel) -> GroupSnapshot:
        expenses = sorted(record.expenses, key=lambda e: (e.expense_date, e.created_at), reverse=True)
        repayments = sorted(record.repayments, key=lambda r: (r.payment_date, r.created_at), reverse=True)
        return GroupSnapshot(
            group=record.group.model_copy(deep=True),
            access=access,
            participants=[p.model_copy(deep=True) for p in record.participants],
            expenses=[e.model_copy(deep=True) for e in expenses],
            repayments=[r.model_copy(deep=True) for r in repayments],
            public_token=record.public_token,
            admin_token=record.admin_token if access == "admin" else None,
        )

    def get_snapshot(self, token: str) -> GroupSnapshot:
        with self._lock:
            record, access = self._resolve(token)
            return self._snapshot(record, access)

    # ------------------------------------------------------------------ #
    # Groups
    # ------------------------------------------------------------------ #

    def _unique_token(self, length: int) -> str:
        token = _code(length)
        while token in self._tokens:
            token = _code(length)
        return token

    def _index(self, record: GroupRecord) -> None:
        self._groups[record.group.id] = record
        self._tokens[record.public_token] = record.group.id
        self._tokens[record.admin_token] = record.group.id

    def insert_seed_group(self, record: GroupRecord) -> None:
        """Install a fully-formed group (used by the demo seed only)."""
        with self._lock:
            self._index(record)

    def create_group(self, payload: CreateGroupRequest) -> CreatedGroup:
        name = payload.name.strip()
        if not name:
            raise LedgerError("validation", "Give the group a name.")
        names = [raw.strip() for raw in payload.participant_names if raw.strip()]
        if len(names) < 2:
            raise LedgerError("validation", "Add at least two people.")

        now = utcnow()
        group_id = _code(16)
        with self._lock:
            record = GroupRecord(
                group=Group(
                    id=group_id,
                    name=name,
                    currency=payload.currency,
                    status="active",
                    created_at=now,
                    updated_at=now,
                ),
                public_token=self._unique_token(32),
                admin_token=self._unique_token(40),
                participants=[
                    Participant(id=_code(16), group_id=group_id, name=name, created_at=now) for name in names
                ],
                expenses=[],
                repayments=[],
            )
            self._index(record)
            return CreatedGroup(
                group=record.group.model_copy(deep=True),
                public_token=record.public_token,
                admin_token=record.admin_token,
            )

    def delete_group(self, token: str) -> None:
        with self._lock:
            record, access = self._resolve(token)
            if access != "admin":
                raise LedgerError("forbidden", "Only the group admin can delete the group.")
            del self._groups[record.group.id]
            self._tokens.pop(record.public_token, None)
            self._tokens.pop(record.admin_token, None)

    @staticmethod
    def _assert_active(record: GroupRecord) -> None:
        if record.group.status == "finished":
            raise LedgerError("group_locked", "This group is finished. Reopen it to make changes.")

    def _mutate(
        self,
        token: str,
        apply: Callable[[GroupRecord], None],
        *,
        admin_only: bool = False,
        allow_finished: bool = False,
    ) -> GroupSnapshot:
        with self._lock:
            record, access = self._resolve(token)
            if admin_only and access != "admin":
                raise LedgerError("forbidden", "Only the group admin can do this.")
            if not allow_finished:
                self._assert_active(record)
            apply(record)
            record.group.updated_at = utcnow()
            return self._snapshot(record, access)

    def finish_group(self, token: str) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            record.group.status = "finished"

        return self._mutate(token, apply, admin_only=True)

    def reopen_group(self, token: str) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            record.group.status = "active"

        return self._mutate(token, apply, admin_only=True, allow_finished=True)

    # ------------------------------------------------------------------ #
    # Participants
    # ------------------------------------------------------------------ #

    def add_participant(self, token: str, name: str) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            clean = name.strip()
            if not clean:
                raise LedgerError("validation", "Enter a name.")
            if any(p.name.lower() == clean.lower() for p in record.participants):
                raise LedgerError("conflict", "Someone with that name is already in the group.")
            record.participants.append(
                Participant(id=_code(16), group_id=record.group.id, name=clean, created_at=utcnow())
            )

        return self._mutate(token, apply)

    def rename_participant(self, token: str, participant_id: str, name: str) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            clean = name.strip()
            if not clean:
                raise LedgerError("validation", "Enter a name.")
            participant = next((p for p in record.participants if p.id == participant_id), None)
            if participant is None:
                raise LedgerError("not_found", "That person is not in this group.")
            if any(p.id != participant_id and p.name.lower() == clean.lower() for p in record.participants):
                raise LedgerError("conflict", "Someone with that name is already in the group.")
            participant.name = clean

        return self._mutate(token, apply)

    # ------------------------------------------------------------------ #
    # Expenses and repayments
    # ------------------------------------------------------------------ #

    @staticmethod
    def _validate_expense(record: GroupRecord, payload: ExpenseRequest) -> None:
        if not payload.description.strip():
            raise LedgerError("validation", "Add a short description.")
        ids = {p.id for p in record.participants}
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
    def _validate_repayment(record: GroupRecord, payload: RepaymentRequest) -> None:
        if payload.payer_participant_id == payload.recipient_participant_id:
            raise LedgerError("validation", "Payer and recipient must be different people.")
        ids = {p.id for p in record.participants}
        if payload.payer_participant_id not in ids or payload.recipient_participant_id not in ids:
            raise LedgerError("validation", "Both people must be in this group.")

    def create_expense(self, token: str, payload: ExpenseRequest) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            self._validate_expense(record, payload)
            now = utcnow()
            record.expenses.append(
                Expense(
                    id=_code(16),
                    group_id=record.group.id,
                    description=payload.description.strip(),
                    amount=payload.amount,
                    paid_by_participant_id=payload.paid_by_participant_id,
                    expense_date=payload.expense_date,
                    split_method=payload.split_method,
                    splits=[s.model_copy(deep=True) for s in payload.splits],
                    created_at=now,
                    updated_at=now,
                )
            )

        return self._mutate(token, apply)

    def update_expense(self, token: str, expense_id: str, payload: ExpenseRequest) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            expense = next((e for e in record.expenses if e.id == expense_id), None)
            if expense is None:
                raise LedgerError("not_found", "That expense no longer exists.")
            self._validate_expense(record, payload)
            expense.description = payload.description.strip()
            expense.amount = payload.amount
            expense.paid_by_participant_id = payload.paid_by_participant_id
            expense.expense_date = payload.expense_date
            expense.split_method = payload.split_method
            expense.splits = [s.model_copy(deep=True) for s in payload.splits]
            expense.updated_at = utcnow()

        return self._mutate(token, apply)

    def delete_expense(self, token: str, expense_id: str) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            index = next((i for i, e in enumerate(record.expenses) if e.id == expense_id), -1)
            if index == -1:
                raise LedgerError("not_found", "That expense no longer exists.")
            record.expenses.pop(index)

        return self._mutate(token, apply)

    def create_repayment(self, token: str, payload: RepaymentRequest) -> GroupSnapshot:
        def apply(record: GroupRecord) -> None:
            self._validate_repayment(record, payload)
            record.repayments.append(
                Repayment(
                    id=_code(16),
                    group_id=record.group.id,
                    payer_participant_id=payload.payer_participant_id,
                    recipient_participant_id=payload.recipient_participant_id,
                    amount=payload.amount,
                    payment_date=payload.payment_date,
                    created_at=utcnow(),
                )
            )

        return self._mutate(token, apply)
