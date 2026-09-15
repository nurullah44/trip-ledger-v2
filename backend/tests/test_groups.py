from fastapi.testclient import TestClient

from app.seed import DEMO_TOKENS


def _new_group(client: TestClient, name: str = "Test Trip") -> dict:
    response = client.post(
        "/groups",
        json={"name": name, "currency": "EUR", "participantNames": ["Ada", "Grace"]},
    )
    assert response.status_code == 201
    return response.json()


def test_create_group_returns_its_two_tokens(client: TestClient) -> None:
    body = _new_group(client)

    assert body["group"]["status"] == "active"
    assert body["group"]["currency"] == "EUR"
    assert len(body["publicToken"]) >= 16
    assert len(body["adminToken"]) >= 16
    assert body["publicToken"] != body["adminToken"]
    assert {key for key in body} == {"group", "publicToken", "adminToken"}


def test_create_group_trims_names_and_drops_blanks(client: TestClient) -> None:
    response = client.post(
        "/groups",
        json={
            "name": "  Alentejo  ",
            "currency": "EUR",
            "participantNames": ["  Ada  ", "   ", "Grace", ""],
        },
    )

    assert response.status_code == 201
    snapshot = client.get(f"/groups/{response.json()['publicToken']}").json()
    assert snapshot["group"]["name"] == "Alentejo"
    assert [p["name"] for p in snapshot["participants"]] == ["Ada", "Grace"]


def test_create_group_needs_two_people_and_a_name(client: TestClient) -> None:
    too_few = client.post(
        "/groups",
        json={"name": "Solo", "currency": "EUR", "participantNames": ["Ada", "  "]},
    )
    blank_name = client.post(
        "/groups",
        json={"name": "   ", "currency": "EUR", "participantNames": ["Ada", "Grace"]},
    )

    assert too_few.status_code == 400
    assert too_few.json() == {"code": "validation", "message": "Add at least two people."}
    assert blank_name.status_code == 400
    assert blank_name.json()["code"] == "validation"


def test_create_group_rejects_unknown_fields(client: TestClient) -> None:
    response = client.post(
        "/groups",
        json={"name": "X", "currency": "EUR", "participantNames": ["A", "B"], "extra": 1},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation"


def test_public_and_admin_tokens_report_their_access(
    client: TestClient, lisbon_public: str, lisbon_admin: str
) -> None:
    public = client.get(f"/groups/{lisbon_public}").json()
    admin = client.get(f"/groups/{lisbon_admin}").json()

    assert public["access"] == "public"
    assert "adminToken" not in public
    assert admin["access"] == "admin"
    assert admin["adminToken"] == lisbon_admin
    assert public["group"] == admin["group"]


def test_unknown_token_is_not_found(client: TestClient) -> None:
    response = client.get("/groups/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "This group link is not valid."}


def test_finish_locks_the_group_until_reopened(
    client: TestClient, lisbon_admin: str, lisbon_public: str, auth_headers: dict[str, str]
) -> None:
    finished = client.post(f"/groups/{lisbon_admin}/finish", headers=auth_headers)
    assert finished.status_code == 200
    assert finished.json()["group"]["status"] == "finished"

    locked = client.post(f"/groups/{lisbon_public}/participants", json={"name": "New"}, )
    assert locked.status_code == 409
    assert locked.json()["code"] == "group_locked"

    again = client.post(f"/groups/{lisbon_admin}/finish", headers=auth_headers)
    assert again.status_code == 409

    reopened = client.post(f"/groups/{lisbon_admin}/reopen", headers=auth_headers)
    assert reopened.status_code == 200
    assert reopened.json()["group"]["status"] == "active"


def test_delete_requires_the_admin_token_and_removes_the_group(
    client: TestClient, lisbon_public: str, lisbon_admin: str, auth_headers: dict[str, str]
) -> None:
    forbidden = client.delete(f"/groups/{lisbon_public}", headers=auth_headers)
    assert forbidden.status_code == 403

    deleted = client.delete(f"/groups/{lisbon_admin}", headers=auth_headers)
    assert deleted.status_code == 204

    assert client.get(f"/groups/{lisbon_admin}").status_code == 404
    assert client.get(f"/groups/{lisbon_public}").status_code == 404


def test_delete_works_on_a_finished_group(
    client: TestClient, lisbon_admin: str, auth_headers: dict[str, str]
) -> None:
    client.post(f"/groups/{lisbon_admin}/finish", headers=auth_headers)

    assert client.delete(f"/groups/{lisbon_admin}", headers=auth_headers).status_code == 204


def test_the_other_seeded_groups_are_still_there(client: TestClient) -> None:
    ski = client.get(f"/groups/{DEMO_TOKENS['ski']['public']}").json()
    cappadocia = client.get(f"/groups/{DEMO_TOKENS['cappadocia']['public']}").json()

    assert ski["group"]["status"] == "finished"
    assert cappadocia["group"]["currency"] == "TRY"
