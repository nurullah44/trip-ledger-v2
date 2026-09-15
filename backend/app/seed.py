"""Demo data: the store starts with three groups and one operator account.

The tokens are fixed so the frontend can be pointed at a known group.
"""

import os
from datetime import date, datetime, timezone

from .models import Expense, ExpenseSplit, Group, Participant, Repayment
from .store import GroupRecord, LedgerStore

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin12345"

DEMO_TOKENS: dict[str, dict[str, str]] = {
    "lisbon": {
        "public": "public-lisbon-4k7q2m9x1b8n3v6c",
        "admin": "admin-lisbon-9z5s2d4f7g1h8j3k6m0p",
    },
    "ski": {
        "public": "public-ski-2w8e5r1t6y9u3i7o0a4s",
        "admin": "admin-ski-7x3c9v2b5n8m1q4z6d0f",
    },
    "cappadocia": {
        "public": "public-cappadocia-5t1y7u3i9o2p6a8s4d0f",
        "admin": "admin-cappadocia-3r8e2w6q1z5x9c4v7b0n",
    },
}


def _at(year: int, month: int, day: int, hour: int = 10, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def _split(participant_id: str, amount: int) -> ExpenseSplit:
    return ExpenseSplit(participant_id=participant_id, amount=amount)


def _lisbon_record() -> GroupRecord:
    group_id = "grp-lisbon"
    tokens = DEMO_TOKENS["lisbon"]
    participants = [
        Participant(id="lis-alex", group_id=group_id, name="Alex", created_at=_at(2026, 9, 11)),
        Participant(id="lis-sam", group_id=group_id, name="Sam", created_at=_at(2026, 9, 11)),
        Participant(id="lis-maya", group_id=group_id, name="Maya", created_at=_at(2026, 9, 11)),
        Participant(id="lis-jordan", group_id=group_id, name="Jordan", created_at=_at(2026, 9, 11)),
    ]
    expenses = [
        Expense(
            id="exp-hotel",
            group_id=group_id,
            description="Hotel Alfama",
            amount=30000,
            paid_by_participant_id="lis-alex",
            expense_date=date(2026, 9, 12),
            split_method="custom",
            splits=[
                _split("lis-alex", 12000),
                _split("lis-sam", 8000),
                _split("lis-maya", 6000),
                _split("lis-jordan", 4000),
            ],
            created_at=_at(2026, 9, 12, 9),
            updated_at=_at(2026, 9, 12, 9),
        ),
        Expense(
            id="exp-tram",
            group_id=group_id,
            description="Tram 28 tickets",
            amount=1440,
            paid_by_participant_id="lis-maya",
            expense_date=date(2026, 9, 13),
            split_method="equal",
            splits=[
                _split("lis-alex", 360),
                _split("lis-sam", 360),
                _split("lis-maya", 360),
                _split("lis-jordan", 360),
            ],
            created_at=_at(2026, 9, 13, 11),
            updated_at=_at(2026, 9, 13, 11),
        ),
        Expense(
            id="exp-dinner",
            group_id=group_id,
            description="Dinner at Time Out",
            amount=8765,
            paid_by_participant_id="lis-sam",
            expense_date=date(2026, 9, 13),
            split_method="equal",
            splits=[
                _split("lis-alex", 2192),
                _split("lis-sam", 2191),
                _split("lis-maya", 2191),
                _split("lis-jordan", 2191),
            ],
            created_at=_at(2026, 9, 13, 20),
            updated_at=_at(2026, 9, 13, 20),
        ),
        Expense(
            id="exp-pasteis",
            group_id=group_id,
            description="Pastéis de Belém",
            amount=1275,
            paid_by_participant_id="lis-jordan",
            expense_date=date(2026, 9, 14),
            split_method="equal",
            splits=[
                _split("lis-alex", 319),
                _split("lis-sam", 319),
                _split("lis-maya", 319),
                _split("lis-jordan", 318),
            ],
            created_at=_at(2026, 9, 14, 16),
            updated_at=_at(2026, 9, 14, 16),
        ),
    ]
    repayments = [
        Repayment(
            id="rep-jordan-alex",
            group_id=group_id,
            payer_participant_id="lis-jordan",
            recipient_participant_id="lis-alex",
            amount=2500,
            payment_date=date(2026, 9, 15),
            created_at=_at(2026, 9, 15, 9),
        )
    ]
    return GroupRecord(
        group=Group(
            id=group_id,
            name="Lisbon Trip",
            currency="EUR",
            status="active",
            created_at=_at(2026, 9, 11),
            updated_at=_at(2026, 9, 15),
        ),
        public_token=tokens["public"],
        admin_token=tokens["admin"],
        participants=participants,
        expenses=expenses,
        repayments=repayments,
    )


def _ski_record() -> GroupRecord:
    group_id = "grp-ski"
    tokens = DEMO_TOKENS["ski"]
    participants = [
        Participant(id="ski-alex", group_id=group_id, name="Alex", created_at=_at(2026, 1, 15)),
        Participant(id="ski-sam", group_id=group_id, name="Sam", created_at=_at(2026, 1, 15)),
        Participant(id="ski-maya", group_id=group_id, name="Maya", created_at=_at(2026, 1, 15)),
    ]
    expenses = [
        Expense(
            id="exp-cabin",
            group_id=group_id,
            description="Cabin rental",
            amount=42000,
            paid_by_participant_id="ski-sam",
            expense_date=date(2026, 1, 18),
            split_method="equal",
            splits=[_split("ski-alex", 14000), _split("ski-sam", 14000), _split("ski-maya", 14000)],
            created_at=_at(2026, 1, 18, 12),
            updated_at=_at(2026, 1, 18, 12),
        )
    ]
    return GroupRecord(
        group=Group(
            id=group_id,
            name="Ski Weekend",
            currency="USD",
            status="finished",
            created_at=_at(2026, 1, 15),
            updated_at=_at(2026, 1, 20),
        ),
        public_token=tokens["public"],
        admin_token=tokens["admin"],
        participants=participants,
        expenses=expenses,
        repayments=[],
    )


def _cappadocia_record() -> GroupRecord:
    group_id = "grp-cappadocia"
    tokens = DEMO_TOKENS["cappadocia"]
    participants = [
        Participant(id="cap-deniz", group_id=group_id, name="Deniz", created_at=_at(2026, 5, 2)),
        Participant(id="cap-emre", group_id=group_id, name="Emre", created_at=_at(2026, 5, 2)),
    ]
    expenses = [
        Expense(
            id="exp-balloon",
            group_id=group_id,
            description="Balloon ride",
            amount=900000,
            paid_by_participant_id="cap-deniz",
            expense_date=date(2026, 5, 3),
            split_method="equal",
            splits=[_split("cap-deniz", 450000), _split("cap-emre", 450000)],
            created_at=_at(2026, 5, 3, 6),
            updated_at=_at(2026, 5, 3, 6),
        )
    ]
    return GroupRecord(
        group=Group(
            id=group_id,
            name="Cappadocia",
            currency="TRY",
            status="active",
            created_at=_at(2026, 5, 2),
            updated_at=_at(2026, 5, 3),
        ),
        public_token=tokens["public"],
        admin_token=tokens["admin"],
        participants=participants,
        expenses=expenses,
        repayments=[],
    )


def seed_demo_data(
    store: LedgerStore,
    *,
    username: str = DEFAULT_ADMIN_USERNAME,
    password: str | None = None,
) -> LedgerStore:
    """Create the operator account and three groups. Returns the same store."""
    store.create_user(username, password or os.environ.get("TRIP_LEDGER_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD))
    for record in (_lisbon_record(), _ski_record(), _cappadocia_record()):
        store.insert_seed_group(record)
    return store
