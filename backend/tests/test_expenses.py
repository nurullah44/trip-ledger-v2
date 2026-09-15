from fastapi.testclient import TestClient

from app.seed import DEMO_TOKENS

PARTICIPANTS = {"alex": "lis-alex", "sam": "lis-sam", "maya": "lis-maya", "jordan": "lis-jordan"}


def _expense(**overrides: object) -> dict:
    payload = {
        "description": "Boat tour",
        "amount": 4000,
        "paidByParticipantId": PARTICIPANTS["alex"],
        "expenseDate": "2026-09-16",
        "splitMethod": "equal",
        "splits": [
            {"participantId": PARTICIPANTS["alex"], "amount": 1000},
            {"participantId": PARTICIPANTS["sam"], "amount": 1000},
            {"participantId": PARTICIPANTS["maya"], "amount": 1000},
            {"participantId": PARTICIPANTS["jordan"], "amount": 1000},
        ],
    }
    payload.update(overrides)
    return payload


def test_seeded_expenses_are_returned_newest_first(client: TestClient, lisbon_public: str) -> None:
    expenses = client.get(f"/groups/{lisbon_public}").json()["expenses"]

    assert [e["expenseDate"] for e in expenses] == [
        "2026-09-14",
        "2026-09-13",
        "2026-09-13",
        "2026-09-12",
    ]
    assert expenses[0]["description"] == "Pastéis de Belém"


def test_create_expense_returns_a_snapshot_containing_it(client: TestClient, lisbon_public: str) -> None:
    response = client.post(f"/groups/{lisbon_public}/expenses", json=_expense())

    assert response.status_code == 201
    body = response.json()
    assert body["expenses"][0]["description"] == "Boat tour"
    assert body["expenses"][0]["splits"] == _expense()["splits"]
    assert sum(s["amount"] for s in body["expenses"][0]["splits"]) == 4000


def test_split_amounts_must_add_up_to_the_total(client: TestClient, lisbon_public: str) -> None:
    payload = _expense(
        splits=[
            {"participantId": PARTICIPANTS["alex"], "amount": 1000},
            {"participantId": PARTICIPANTS["sam"], "amount": 1000},
        ]
    )

    response = client.post(f"/groups/{lisbon_public}/expenses", json=payload)

    assert response.status_code == 400
    assert response.json() == {
        "code": "validation",
        "message": "The split amounts must add up to the total.",
    }


def test_expense_rejects_an_outsider_in_the_splits(client: TestClient, lisbon_public: str) -> None:
    payload = _expense(
        splits=[
            {"participantId": PARTICIPANTS["alex"], "amount": 2000},
            {"participantId": "someone-else", "amount": 2000},
        ]
    )

    response = client.post(f"/groups/{lisbon_public}/expenses", json=payload)

    assert response.status_code == 400
    assert response.json()["message"] == "Everyone included must be in this group."


def test_expense_rejects_a_repeated_participant(client: TestClient, lisbon_public: str) -> None:
    payload = _expense(
        splits=[
            {"participantId": PARTICIPANTS["alex"], "amount": 2000},
            {"participantId": PARTICIPANTS["alex"], "amount": 2000},
        ]
    )

    response = client.post(f"/groups/{lisbon_public}/expenses", json=payload)

    assert response.status_code == 400
    assert response.json()["message"] == "Someone is included twice."


def test_expense_rejects_an_unknown_payer(client: TestClient, lisbon_public: str) -> None:
    response = client.post(f"/groups/{lisbon_public}/expenses", json=_expense(paidByParticipantId="ghost"))

    assert response.status_code == 400
    assert response.json()["message"] == "Choose who paid."


def test_expense_rejects_a_non_positive_amount(client: TestClient, lisbon_public: str) -> None:
    response = client.post(f"/groups/{lisbon_public}/expenses", json=_expense(amount=0))

    assert response.status_code == 400
    assert response.json()["code"] == "validation"


def test_update_expense_replaces_it(client: TestClient, lisbon_public: str) -> None:
    response = client.put(
        f"/groups/{lisbon_public}/expenses/exp-hotel",
        json=_expense(description="Hotel Alfama (refunded)", amount=2000, splits=[
            {"participantId": PARTICIPANTS["alex"], "amount": 2000},
        ]),
    )

    assert response.status_code == 200
    updated = next(e for e in response.json()["expenses"] if e["id"] == "exp-hotel")
    assert updated["amount"] == 2000
    assert updated["description"] == "Hotel Alfama (refunded)"


def test_update_rejects_an_unknown_expense(client: TestClient, lisbon_public: str) -> None:
    response = client.put(f"/groups/{lisbon_public}/expenses/nope", json=_expense())

    assert response.status_code == 404
    assert response.json()["message"] == "That expense no longer exists."


def test_delete_expense_removes_it(client: TestClient, lisbon_public: str) -> None:
    response = client.delete(f"/groups/{lisbon_public}/expenses/exp-hotel")

    assert response.status_code == 200
    assert all(e["id"] != "exp-hotel" for e in response.json()["expenses"])

    missing = client.delete(f"/groups/{lisbon_public}/expenses/exp-hotel")
    assert missing.status_code == 404


def test_expenses_are_read_only_on_a_finished_group(client: TestClient) -> None:
    ski_public = DEMO_TOKENS["ski"]["public"]

    response = client.post(f"/groups/{ski_public}/expenses", json=_expense())

    assert response.status_code == 409
    assert response.json()["code"] == "group_locked"
