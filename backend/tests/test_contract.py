"""The backend is only correct if it still matches ../../openapi.yaml."""

import re
from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from app.database import Database
from app.errors import STATUS_BY_CODE
from app.main import create_app
from app.seed import DEMO_TOKENS

SPEC_PATH = Path(__file__).resolve().parents[2] / "openapi.yaml"
METHODS = {"get", "post", "put", "patch", "delete"}


def _spec() -> dict:
    return yaml.safe_load(SPEC_PATH.read_text())


def _normalized(path: str) -> str:
    """`/groups/{token}` and `/groups/{token:path}` compare as `/groups/{}`."""
    return re.sub(r"\{[^}]+\}", "{}", path)


def _implemented_routes() -> set[tuple[str, str]]:
    """Every path+method FastAPI serves, read off the app's own OpenAPI schema."""
    return {
        (method.upper(), _normalized(path))
        for path, item in create_app(Database("sqlite://"), seed=False).openapi()["paths"].items()
        for method in item
        if method in METHODS
    }


def test_every_spec_operation_is_implemented() -> None:
    spec = _spec()
    expected = {
        (method.upper(), _normalized(path))
        for path, item in spec["paths"].items()
        for method in item
        if method in METHODS
    }

    assert expected <= _implemented_routes(), expected - _implemented_routes()


def test_no_ledger_operation_is_missing_from_the_spec() -> None:
    spec = _spec()
    documented = {
        (method.upper(), _normalized(path))
        for path, item in spec["paths"].items()
        for method in item
        if method in METHODS
    }
    ledger_prefixes = ("/groups", "/auth/login")
    implemented = {
        (method, path)
        for method, path in _implemented_routes()
        if path.startswith(ledger_prefixes)
    }

    assert implemented <= documented, implemented - documented


def test_error_codes_match_the_spec() -> None:
    codes = set(_spec()["components"]["schemas"]["LedgerError"]["properties"]["code"]["enum"])

    assert codes == set(STATUS_BY_CODE)


def test_admin_operations_declare_bearer_security() -> None:
    spec = _spec()
    admin_operations = 0
    for item in spec["paths"].values():
        for method, operation in item.items():
            if method not in METHODS:
                continue
            if operation.get("x-credential") == "admin + bearer":
                assert operation.get("security") == [{"BearerAuth": []}]
                admin_operations += 1
            else:
                assert not operation.get("security")

    assert admin_operations == 3


def test_snapshot_response_matches_the_spec_fields(client: TestClient) -> None:
    spec = _spec()
    required = set(spec["components"]["schemas"]["GroupSnapshot"]["required"])
    optional = set(spec["components"]["schemas"]["GroupSnapshot"]["properties"]) - required

    public = client.get(f"/groups/{DEMO_TOKENS['lisbon']['public']}").json()
    admin = client.get(f"/groups/{DEMO_TOKENS['lisbon']['admin']}").json()

    assert required <= set(public)
    assert set(public) == required
    assert set(admin) == required | {"adminToken"}
    assert optional == {"adminToken"}
