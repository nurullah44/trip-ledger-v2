# Architecture

## Frontend

TanStack Start + React 19 + Tailwind v4 + shadcn/ui, lives in `frontend/`.

Every backend call goes through one service layer: `frontend/src/services/`
defines `LedgerService` and implements it twice — `http-ledger-service.ts` talks
to this API (the default), `mock-ledger-service.ts` is a localStorage stand-in
used with `VITE_USE_MOCK=1` for frontend-only work. Screens never change when
the implementation does.

In dev, Vite proxies `/groups` and `/auth` to the API on `:8000`, so the browser
stays on one origin and the contract's `servers: [/]` holds. Finish, reopen, and
delete carry a bearer session obtained from `POST /auth/login`; the group screen
asks for the operator account when a session is missing.

## Backend

FastAPI, managed with `uv`, in `backend/` (`app/` package, `tests/` for backend
tests). It implements `openapi.yaml` against an in-memory store seeded with
three demo groups (`backend/app/seed.py`), so the API serves real data the
moment it starts; state resets on restart.

Group access stays link-based. The admin operations — finish, reopen, delete —
additionally require a bearer session for an operator account whose password is
stored as a PBKDF2 hash. That session is the one deliberate deviation from
`specs.md`'s "no sign-in", and it is scoped to those three endpoints; every other
route authenticates with the group link token alone.
