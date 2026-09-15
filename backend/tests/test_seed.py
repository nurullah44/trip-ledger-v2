from fastapi.testclient import TestClient

from app.seed import DEMO_TOKENS


def test_lisbon_group_is_seeded_for_the_frontend(client: TestClient) -> None:
    snapshot = client.get(f"/groups/{DEMO_TOKENS['lisbon']['public']}").json()

    assert snapshot["group"]["name"] == "Lisbon Trip"
    assert snapshot["group"]["currency"] == "EUR"
    assert snapshot["group"]["status"] == "active"
    assert [p["name"] for p in snapshot["participants"]] == ["Alex", "Sam", "Maya", "Jordan"]
    assert len(snapshot["expenses"]) == 4
    assert len(snapshot["repayments"]) == 1


def test_every_seeded_expense_splits_to_its_total(client: TestClient, lisbon_public: str) -> None:
    expenses = client.get(f"/groups/{lisbon_public}").json()["expenses"]

    for expense in expenses:
        assert sum(split["amount"] for split in expense["splits"]) == expense["amount"]


def test_seeded_expenses_reference_known_participants(client: TestClient, lisbon_public: str) -> None:
    snapshot = client.get(f"/groups/{lisbon_public}").json()
    participant_ids = {p["id"] for p in snapshot["participants"]}

    for expense in snapshot["expenses"]:
        assert expense["paidByParticipantId"] in participant_ids
        assert {split["participantId"] for split in expense["splits"]} <= participant_ids

    for repayment in snapshot["repayments"]:
        assert repayment["payerParticipantId"] in participant_ids
        assert repayment["recipientParticipantId"] in participant_ids


def test_seed_covers_the_locked_and_foreign_currency_cases(client: TestClient) -> None:
    ski = client.get(f"/groups/{DEMO_TOKENS['ski']['public']}").json()
    cappadocia = client.get(f"/groups/{DEMO_TOKENS['cappadocia']['public']}").json()

    assert ski["group"]["status"] == "finished"
    assert ski["expenses"][0]["splitMethod"] == "equal"
    assert cappadocia["group"]["currency"] == "TRY"
    assert cappadocia["expenses"][0]["amount"] == 900000


def test_demo_tokens_are_long_enough_to_be_unguessable(client: TestClient) -> None:
    for tokens in DEMO_TOKENS.values():
        assert len(tokens["public"]) >= 16
        assert len(tokens["admin"]) >= 16
        assert client.get(f"/groups/{tokens['public']}").status_code == 200
