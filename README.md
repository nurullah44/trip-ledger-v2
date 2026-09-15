# Trip Ledger

A no-account, link-based shared expense ledger for trips: create a group, add
expenses, see net balances, and settle up with the fewest transfers.

- `frontend/` — the React + TanStack Start app; run it with `frontend/README.md`.
- `docs/` — product scope (`specs.md`), architecture, and the Clay design system.
- `backend/` — the FastAPI service; see `backend/README.md` for run commands and seeded demo links.
- `openapi.yaml` — the API agreement the backend implements.
- `AGENTS.md` — instructions for coding agents.

## Run it

```sh
make install   # once
make dev       # frontend on :8080, API on :8000 (docs at http://localhost:8000/docs)
make help      # every target
```
