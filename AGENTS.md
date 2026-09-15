# Trip Ledger — agent notes

A no-account, link-based expense-splitting web app. Product scope is in
`docs/specs.md`; stack and architecture in `docs/architecture.md`.

## Project layout

- `frontend/` — the React 19 + TanStack Start app (Vite, Tailwind v4, shadcn/ui):
  - `frontend/src/domain/` — pure, unit-tested logic: money in integer minor
    units (`money.ts`), net balances and the greedy settlement plan
    (`balances.ts`), shared types (`types.ts`).
  - `frontend/src/services/` — the frontend's only data boundary.
    `ledger-service.ts` defines the `LedgerService` interface and `LedgerError`,
    `http-ledger-service.ts` + `api.ts` implement it against the FastAPI backend,
    `session.ts` keeps the admin bearer token, and `mock-ledger-service.ts` is the
    localStorage stand-in used when `VITE_USE_MOCK=1`.
  - `frontend/src/lib/use-ledger.ts` — React Query hooks over the service; group
    queries are client-gated because the mock reads localStorage.
  - `frontend/src/routes/` — file-based routes: `/` (create), `/g/$token`
    (group), `/g/$token/expense/new` + `/g/$token/expense/$expenseId`,
    `/g/$token/settle`. Public vs. admin access comes from which token resolved
    the group.
  - `frontend/src/components/` — app components; `frontend/src/components/ui/`
    is the shadcn/ui set, added with the shadcn CLI.
- `docs/` — `specs.md` (product scope), `architecture.md`, and `design/` (the
  vendored OpenDesign "Clay receipt" system; `docs/design/clay/tokens.css` is the
  canonical colour block).
- `backend/` — the FastAPI service implementing `openapi.yaml` against a seeded
  in-memory store (`app/` package, `tests/` for backend tests).

## Commands

The root `Makefile` wraps every command below: `make install`, `make dev`
(frontend and API together), `make test`, `make lint`, `make check`, `make spec`,
`make clean`. `make help` lists them.

Frontend (run from `frontend/`):

- `npm install` — install dependencies
- `npm run dev` — Vite dev server
- `npx vitest run` — the whole test suite
- `npx vitest run src/domain/money.test.ts` — one test file
- `npm run lint` — ESLint
- `npm run build` — type-check and build

Backend (run from `backend/`):

- `uv sync` — install dependencies
- `uv run pytest` — the whole suite
- `uv run pytest tests/test_groups.py` — one test file
- `uv run uvicorn app.main:app --reload --host 0.0.0.0` — API dev server (docs at `/docs`)

## Workflow

- The product scope and its v1 out-of-scope list are in `docs/specs.md`; check a
  feature against it before building.
- `openapi.yaml` is the contract: change it first, and keep backend endpoints
  and `frontend/src/services/` matching it.
- Backend endpoints come with a test in `backend/tests/`; frontend domain and
  service changes with a case in the neighbouring `*.test.ts`.
- Finish with `npx vitest run`, `npm run lint`, and `npm run build` in
  `frontend/`, plus `uv run pytest` in `backend/`.

## Rules

- Money stays integer minor units of the group's currency on both sides;
  frontend arithmetic goes through `frontend/src/domain/money.ts`.
- The frontend reaches data through `ledgerService` or the `use-ledger` hooks
  and calculations through `frontend/src/domain/`; every network call goes
  through `frontend/src/services/api.ts`.
- Admin actions (finish, reopen, delete) need a bearer session; the group screen
  asks for the operator account when it is missing. Public links stay
  account-free.
- Access is token-based — public vs. admin comes from which token resolved the
  group. Accounts, sign-in, and payment integrations stay out (`docs/specs.md`'s
  out-of-scope list).
- Backend dependencies are added in `backend/pyproject.toml` with `uv add`;
  frontend dependencies in `frontend/package.json`. Confirm with the user before
  adding one.
- Colour lives in the tokens: edit `docs/design/clay/tokens.css` and the mirrored
  `:root` block in `frontend/src/styles.css` together, then style with the
  semantic shadcn classes.

## Documents

- `openapi.yaml` — the API contract: endpoints, payloads, credentials, and the
  error codes the frontend maps to `LedgerError`.
- `docs/specs.md` — product scope: screens, data model, validation rules, and the
  v1 out-of-scope list.
- `docs/architecture.md` — stack, the service-layer decision, and the FastAPI
  backend.
- `backend/README.md` — run commands, the seeded demo tokens, and the operator
  account for admin endpoints.
- `docs/design/README.md` — how the Clay tokens map onto shadcn variables and how
  to evolve the theme; `docs/design/clay/DESIGN.md` for palette roles and
  do's/don'ts.
- `frontend/README.md` — how to run the app, the API proxy, and
  `VITE_USE_MOCK`.
- `frontend/src/routes/README.md` — file-based routing conventions;
  `routeTree.gen.ts` is generated from the route files.
