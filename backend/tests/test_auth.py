from fastapi.testclient import TestClient

from app.auth import verify_password
from app.seed import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME
from app.store import LedgerStore


def test_login_returns_bearer_session(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"username": DEFAULT_ADMIN_USERNAME, "password": DEFAULT_ADMIN_PASSWORD},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert len(body["accessToken"]) >= 32
    assert body["expiresAt"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"username": DEFAULT_ADMIN_USERNAME, "password": "not-the-password"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_login_rejects_unknown_user(client: TestClient) -> None:
    response = client.post("/auth/login", json={"username": "nobody", "password": "whatever"})

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_login_validates_body(client: TestClient) -> None:
    response = client.post("/auth/login", json={"username": DEFAULT_ADMIN_USERNAME})

    assert response.status_code == 400
    assert response.json()["code"] == "validation"


def test_password_is_hashed_with_a_salt(store: LedgerStore) -> None:
    stored = store.password_hash_for(DEFAULT_ADMIN_USERNAME)

    assert stored is not None
    assert DEFAULT_ADMIN_PASSWORD not in stored
    assert stored.startswith("pbkdf2_sha256$")
    assert verify_password(DEFAULT_ADMIN_PASSWORD, stored)

    store.create_user("other", DEFAULT_ADMIN_PASSWORD)
    assert store.password_hash_for("other") != stored


def test_admin_endpoints_require_a_bearer_token(client: TestClient, lisbon_admin: str) -> None:
    response = client.post(f"/groups/{lisbon_admin}/finish")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_unknown_bearer_token_is_rejected(client: TestClient, lisbon_admin: str) -> None:
    response = client.post(
        f"/groups/{lisbon_admin}/finish",
        headers={"Authorization": "Bearer not-a-real-session"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_public_token_is_forbidden_even_with_a_session(
    client: TestClient, lisbon_public: str, auth_headers: dict[str, str]
) -> None:
    response = client.post(f"/groups/{lisbon_public}/finish", headers=auth_headers)

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


def test_public_endpoints_do_not_need_a_session(client: TestClient, lisbon_public: str) -> None:
    assert client.get(f"/groups/{lisbon_public}").status_code == 200
