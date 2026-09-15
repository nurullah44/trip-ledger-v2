# Trip Ledger — backend

FastAPI implementation of [`../openapi.yaml`](../openapi.yaml), backed by an
in-memory store that is seeded with demo groups on startup. State resets every
time the process restarts.

## Commands

Run from `backend/`:

- `uv sync` — install dependencies (and create `.venv`)
- `uv run uvicorn app.main:app --reload` — dev server on <http://localhost:8000> (`/docs` for the interactive schema)
- `uv run pytest` — the whole suite
- `uv run pytest tests/test_expenses.py` — one test file

## Seeded demo data

| Group       | Currency | Status   | Public token                          | Admin token                          |
| ----------- | -------- | -------- | ------------------------------------- | ------------------------------------ |
| Lisbon Trip | EUR      | active   | `public-lisbon-4k7q2m9x1b8n3v6c`      | `admin-lisbon-9z5s2d4f7g1h8j3k6m0p`  |
| Ski Weekend | USD      | finished | `public-ski-2w8e5r1t6y9u3i7o0a4s`      | `admin-ski-7x3c9v2b5n8m1q4z6d0f`     |
| Cappadocia  | TRY      | active   | `public-cappadocia-5t1y7u3i9o2p6a8s4d0f` | `admin-cappadocia-3r8e2w6q1z5x9c4v7b0n` |

`GET /groups/<token>` with a token above is enough to see data.

The operator account for admin endpoints (`finish`, `reopen`, `delete`) is
`admin` / `admin12345`; set `TRIP_LEDGER_ADMIN_PASSWORD` to override the
password. Passwords are stored as salted PBKDF2-HMAC-SHA256 digests and bearer
sessions are stored hashed, so neither survives in the clear in the store.

## Layout

- `app/main.py` — `create_app()` and the module-level `app` uvicorn targets.
- `app/models.py` — Pydantic models mirroring the OpenAPI schemas (snake_case in Python, camelCase in JSON).
- `app/store.py` — the in-memory store: lock, tokens, validation rules, snapshots.
- `app/auth.py` — password hashing, session tokens, the `require_session` dependency.
- `app/errors.py` — `LedgerError` and the `{code, message}` handlers.
- `app/seed.py` — the demo groups and the operator account.
- `app/routers/` — one router per resource, plus `auth`.
- `tests/` — API tests with `TestClient`, including a check that the app still matches `openapi.yaml`.

## Notes

- There is no database; the store lives in process memory behind a lock.
- Bearer sessions last 12 hours (`SESSION_TTL` in `app/auth.py`).
- Auth is scoped to the three admin endpoints; everything else authenticates
  with the group link token alone, so the frontend keeps working without a
  session.
