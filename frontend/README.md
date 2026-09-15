# Trip Ledger — frontend

The React + TanStack Start app. Run every command from this directory; the
repository root holds `docs/`, `backend/` (planned), and `openapi.yaml`.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>/frontend
npm i
npm run dev
```

See the repo root `AGENTS.md` for the route, domain, and design-system layout.

## Talking to the API

The app calls the FastAPI backend through the Vite dev proxy (`/groups`, `/auth`
→ `:8000`), so `make dev` must be running both, or the app cannot load a group.
For frontend-only work, run against the localStorage mock instead:

```sh
VITE_USE_MOCK=1 npm run dev
```

Finish, reopen, and delete need the operator account (`backend/README.md`); the
group screen asks for it the first time and keeps the bearer session in
localStorage.
