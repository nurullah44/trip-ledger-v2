# Trip Ledger — backend

FastAPI implementation of [`../openapi.yaml`](../openapi.yaml), backed by a
SQLAlchemy database. An empty database is seeded with demo groups on startup;
anything already stored is kept.

## Commands

Run from `backend/`:

- `uv sync` — install dependencies (and create `.venv`)
- `uv run uvicorn app.main:app --reload --reload-dir app` — dev server on <http://localhost:8000> (`/docs` for the interactive schema)
- `uv run pytest` — the whole suite
- `uv run pytest tests/test_expenses.py` — one test file

## Database

The server connects to whatever `TRIP_LEDGER_DATABASE_URL` points at:

```sh
TRIP_LEDGER_DATABASE_URL=sqlite:///./trip-ledger.db   uv run uvicorn app.main:app   # default
TRIP_LEDGER_DATABASE_URL=sqlite:////tmp/trip.db       uv run uvicorn app.main:app
```

No code changes are needed to move to another database — install the driver and
change the URL:

```sh
uv sync --extra postgres
TRIP_LEDGER_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/trip_ledger uv run uvicorn app.main:app
```

Tables are created on startup (`create_all`), which is enough for SQLite and a
first Postgres run; a production deployment should add migrations (Alembic) at
that point. To start over, delete the SQLite file and restart.

## Seeded demo data

Written only into an empty database:

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
- `app/database.py` — engine, session factory, and `TRIP_LEDGER_DATABASE_URL`.
- `app/tables.py` — the SQLAlchemy tables.
- `app/models.py` — Pydantic models mirroring the OpenAPI schemas (snake_case in Python, camelCase in JSON).
- `app/store.py` — the store: resolves tokens, validates, writes rows, builds snapshots.
- `app/deps.py` — one session and one store per request, plus `require_session`.
- `app/auth.py` — password hashing and session tokens.
- `app/errors.py` — `LedgerError` and the `{code, message}` handlers.
- `app/seed.py` — the demo groups and the operator account.
- `app/routers/` — one router per resource, plus `auth`.
- `tests/` — API tests with `TestClient`, a database/persistence suite, and a check that the app still matches `openapi.yaml`.

## Notes

- Rows live in the database, not in memory: one session per request, committed
  when the request succeeds. The schema uses only portable column types, so
  moving to Postgres is an environment change plus its driver.
- Bearer sessions last 12 hours (`SESSION_TTL` in `app/auth.py`).
- Auth is scoped to the three admin endpoints; everything else authenticates
  with the group link token alone, so the frontend keeps working without a
  session.
