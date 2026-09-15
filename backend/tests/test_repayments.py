from fastapi.testclient import TestClient

from app.seed import DEMO_TOKENS


def test_seeded_repayment_is_visible(client: TestClient, lisbon_public: str) -> None:
    repayments = client.get(f"/groups/{lisbon_public}").json()["repayments"]

    assert len(repayments) == 1
    assert repayments[0]["amount"] == 2500
    assert repayments[0]["payerParticipantId"] == "lis-jordan"
    assert repayments[0]["recipientParticipantId"] == "lis-alex"


def test_create_repayment_records_it_in_order(client: TestClient, lisbon_public: str) -> None:
    response = client.post(
        f"/groups/{lisbon_public}/repayments",
        json={
            "payerParticipantId": "lis-sam",
            "recipientParticipantId": "lis-maya",
            "amount": 1200,
            "paymentDate": "2026-09-16",
        },
    )

    assert response.status_code == 201
    repayments = response.json()["repayments"]
    assert repayments[0]["payerParticipantId"] == "lis-sam"
    assert [r["paymentDate"] for r in repayments] == ["2026-09-16", "2026-09-15"]


def test_repayment_needs_two_different_people(client: TestClient, lisbon_public: str) -> None:
    response = client.post(
        f"/groups/{lisbon_public}/repayments",
        json={
            "payerParticipantId": "lis-sam",
            "recipientParticipantId": "lis-sam",
            "amount": 500,
            "paymentDate": "2026-09-16",
        },
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Payer and recipient must be different people."


def test_repayment_rejects_outsiders(client: TestClient, lisbon_public: str) -> None:
    response = client.post(
        f"/groups/{lisbon_public}/repayments",
        json={
            "payerParticipantId": "lis-sam",
            "recipientParticipantId": "ghost",
            "amount": 500,
            "paymentDate": "2026-09-16",
        },
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Both people must be in this group."


def test_repayment_amount_must_be_positive(client: TestClient, lisbon_public: str) -> None:
    response = client.post(
        f"/groups/{lisbon_public}/repayments",
        json={
            "payerParticipantId": "lis-sam",
            "recipientParticipantId": "lis-maya",
            "amount": 0,
            "paymentDate": "2026-09-16",
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation"


def test_repayments_are_read_only_on_a_finished_group(client: TestClient) -> None:
    response = client.post(
        f"/groups/{DEMO_TOKENS['ski']['public']}/repayments",
        json={
            "payerParticipantId": "ski-sam",
            "recipientParticipantId": "ski-maya",
            "amount": 500,
            "paymentDate": "2026-02-01",
        },
    )

    assert response.status_code == 409
    assert response.json()["code"] == "group_locked"
