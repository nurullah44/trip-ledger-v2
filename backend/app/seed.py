"""Demo data: three groups and one operator account, written once into an empty
database. The tokens are fixed so the frontend can be pointed at a known group.
"""

import os
from datetime import date, datetime, timezone

from sqlalchemy import func, select

from .store import GroupSeed, LedgerStore, SeedExpense, SeedParticipant, SeedRepayment
from .tables import GroupRow, UserRow

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


def _lisbon_seed() -> GroupSeed:
    group_id = "grp-lisbon"
    tokens = DEMO_TOKENS["lisbon"]
    return GroupSeed(
        id=group_id,
        name="Lisbon Trip",
        currency="EUR",
        status="active",
        created_at=_at(2026, 9, 11),
        updated_at=_at(2026, 9, 15),
        public_token=tokens["public"],
        admin_token=tokens["admin"],
        participants=[
            SeedParticipant(id="lis-alex", name="Alex"),
            SeedParticipant(id="lis-sam", name="Sam"),
            SeedParticipant(id="lis-maya", name="Maya"),
            SeedParticipant(id="lis-jordan", name="Jordan"),
        ],
        expenses=[
            SeedExpense(
                id="exp-hotel",
                description="Hotel Alfama",
                amount=30000,
                paid_by_participant_id="lis-alex",
                expense_date=date(2026, 9, 12),
                split_method="custom",
                splits=[
                    ("lis-alex", 12000),
                    ("lis-sam", 8000),
                    ("lis-maya", 6000),
                    ("lis-jordan", 4000),
                ],
                created_at=_at(2026, 9, 12, 9),
            ),
            SeedExpense(
                id="exp-tram",
                description="Tram 28 tickets",
                amount=1440,
                paid_by_participant_id="lis-maya",
                expense_date=date(2026, 9, 13),
                split_method="equal",
                splits=[
                    ("lis-alex", 360),
                    ("lis-sam", 360),
                    ("lis-maya", 360),
                    ("lis-jordan", 360),
                ],
                created_at=_at(2026, 9, 13, 11),
            ),
            SeedExpense(
                id="exp-dinner",
                description="Dinner at Time Out",
                amount=8765,
                paid_by_participant_id="lis-sam",
                expense_date=date(2026, 9, 13),
                split_method="equal",
                splits=[
                    ("lis-alex", 2192),
                    ("lis-sam", 2191),
                    ("lis-maya", 2191),
                    ("lis-jordan", 2191),
                ],
                created_at=_at(2026, 9, 13, 20),
            ),
            SeedExpense(
                id="exp-pasteis",
                description="Pastéis de Belém",
                amount=1275,
                paid_by_participant_id="lis-jordan",
                expense_date=date(2026, 9, 14),
                split_method="equal",
                splits=[
                    ("lis-alex", 319),
                    ("lis-sam", 319),
                    ("lis-maya", 319),
                    ("lis-jordan", 318),
                ],
                created_at=_at(2026, 9, 14, 16),
            ),
        ],
        repayments=[
            SeedRepayment(
                id="rep-jordan-alex",
                payer_participant_id="lis-jordan",
                recipient_participant_id="lis-alex",
                amount=2500,
                payment_date=date(2026, 9, 15),
                created_at=_at(2026, 9, 15, 9),
            )
        ],
    )


def _ski_seed() -> GroupSeed:
    group_id = "grp-ski"
    tokens = DEMO_TOKENS["ski"]
    return GroupSeed(
        id=group_id,
        name="Ski Weekend",
        currency="USD",
        status="finished",
        created_at=_at(2026, 1, 15),
        updated_at=_at(2026, 1, 20),
        public_token=tokens["public"],
        admin_token=tokens["admin"],
        participants=[
            SeedParticipant(id="ski-alex", name="Alex"),
            SeedParticipant(id="ski-sam", name="Sam"),
            SeedParticipant(id="ski-maya", name="Maya"),
        ],
        expenses=[
            SeedExpense(
                id="exp-cabin",
                description="Cabin rental",
                amount=42000,
                paid_by_participant_id="ski-sam",
                expense_date=date(2026, 1, 18),
                split_method="equal",
                splits=[("ski-alex", 14000), ("ski-sam", 14000), ("ski-maya", 14000)],
                created_at=_at(2026, 1, 18, 12),
            )
        ],
    )


def _cappadocia_seed() -> GroupSeed:
    group_id = "grp-cappadocia"
    tokens = DEMO_TOKENS["cappadocia"]
    return GroupSeed(
        id=group_id,
        name="Cappadocia",
        currency="TRY",
        status="active",
        created_at=_at(2026, 5, 2),
        updated_at=_at(2026, 5, 3),
        public_token=tokens["public"],
        admin_token=tokens["admin"],
        participants=[
            SeedParticipant(id="cap-deniz", name="Deniz"),
            SeedParticipant(id="cap-emre", name="Emre"),
        ],
        expenses=[
            SeedExpense(
                id="exp-balloon",
                description="Balloon ride",
                amount=900000,
                paid_by_participant_id="cap-deniz",
                expense_date=date(2026, 5, 3),
                split_method="equal",
                splits=[("cap-deniz", 450000), ("cap-emre", 450000)],
                created_at=_at(2026, 5, 3, 6),
            )
        ],
    )


def seed_demo_data(
    store: LedgerStore,
    *,
    username: str = DEFAULT_ADMIN_USERNAME,
    password: str | None = None,
) -> LedgerStore:
    """Write the operator account and the three demo groups. Returns the store."""
    store.create_user(
        username,
        password or os.environ.get("TRIP_LEDGER_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD),
    )
    for seed in (_lisbon_seed(), _ski_seed(), _cappadocia_seed()):
        store.insert_seed_group(seed)
    return store


def seed_if_empty(
    store: LedgerStore,
    *,
    username: str = DEFAULT_ADMIN_USERNAME,
    password: str | None = None,
) -> bool:
    """Seed only what is missing, so a restart on an existing database is a no-op."""
    seeded = False
    if not store.session.scalar(select(func.count()).select_from(GroupRow)):
        for seed in (_lisbon_seed(), _ski_seed(), _cappadocia_seed()):
            store.insert_seed_group(seed)
        seeded = True
    if not store.session.scalar(select(func.count()).select_from(UserRow)):
        store.create_user(
            username,
            password or os.environ.get("TRIP_LEDGER_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD),
        )
        seeded = True
    return seeded
