# Trip Ledger

A no-account, link-based shared expense ledger for trips: create a group, add
expenses, see net balances, and settle up with the fewest transfers.

- `frontend/` — the React + TanStack Start app.
- `backend/` — the FastAPI service (SQLAlchemy; SQLite by default, Postgres-ready).
- `openapi.yaml` — the API contract the backend implements.
- `docs/` — product scope (`specs.md`), architecture, and the Clay design system.
- `AGENTS.md` — instructions for coding agents.

## Run it

You need three things installed:

| Tool | Why | Install |
| --- | --- | --- |
| Node.js (with npm) | the frontend | [nodejs.org](https://nodejs.org) or [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | Python deps for the API | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `make` | the commands below | `sudo apt-get install make` (Debian/Ubuntu), `xcode-select --install` (macOS) |

Then:

```sh
git clone <this-repository-url>
cd <repository-name>

make install   # npm install + uv sync (once)
make dev       # API on http://localhost:8000, app on http://localhost:8080
```

`Ctrl-C` stops both. Open <http://localhost:8080> to create a group, or open one
of the seeded demo groups — the links and the operator account for admin actions
are in [`backend/README.md`](backend/README.md). The database is a local SQLite
file (`backend/trip-ledger.db`, seeded on first start); delete it to start over.

Other targets: `make help` (all of them), `make test`, `make check` (typecheck +
lint + both test suites), `make spec` (validate `openapi.yaml`).

If `make dev` complains about the ports, something else is on 8080 or 8000 —
stop it and run it again.
