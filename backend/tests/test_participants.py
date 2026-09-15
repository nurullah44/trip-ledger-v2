from fastapi.testclient import TestClient

from app.seed import DEMO_TOKENS


def test_add_participant_returns_the_full_snapshot(client: TestClient, lisbon_public: str) -> None:
    response = client.post(f"/groups/{lisbon_public}/participants", json={"name": "Nadia"})

    assert response.status_code == 200
    names = [p["name"] for p in response.json()["participants"]]
    assert names == ["Alex", "Sam", "Maya", "Jordan", "Nadia"]


def test_add_participant_rejects_a_blank_name(client: TestClient, lisbon_public: str) -> None:
    response = client.post(f"/groups/{lisbon_public}/participants", json={"name": "   "})

    assert response.status_code == 400
    assert response.json() == {"code": "validation", "message": "Enter a name."}


def test_add_participant_rejects_a_duplicate_name_case_insensitively(
    client: TestClient, lisbon_public: str
) -> None:
    response = client.post(f"/groups/{lisbon_public}/participants", json={"name": "  sam "})

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


def test_rename_participant(client: TestClient, lisbon_public: str) -> None:
    snapshot = client.get(f"/groups/{lisbon_public}").json()
    participant_id = next(p["id"] for p in snapshot["participants"] if p["name"] == "Maya")

    response = client.patch(
        f"/groups/{lisbon_public}/participants/{participant_id}",
        json={"name": "Maya P."},
    )

    assert response.status_code == 200
    assert any(p["name"] == "Maya P." for p in response.json()["participants"])


def test_rename_rejects_an_unknown_participant(client: TestClient, lisbon_public: str) -> None:
    response = client.patch(f"/groups/{lisbon_public}/participants/nope", json={"name": "Ada"})

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_rename_rejects_a_taken_name(client: TestClient, lisbon_public: str) -> None:
    snapshot = client.get(f"/groups/{lisbon_public}").json()
    participant_id = next(p["id"] for p in snapshot["participants"] if p["name"] == "Maya")

    response = client.patch(
        f"/groups/{lisbon_public}/participants/{participant_id}",
        json={"name": "alex"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


def test_participants_are_read_only_on_a_finished_group(client: TestClient) -> None:
    ski_public = DEMO_TOKENS["ski"]["public"]

    response = client.post(f"/groups/{ski_public}/participants", json={"name": "Late"})

    assert response.status_code == 409
    assert response.json()["code"] == "group_locked"
