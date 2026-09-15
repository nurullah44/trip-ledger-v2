"""Trip Ledger API — FastAPI implementation of ../../openapi.yaml.

The store is in-memory and seeded on startup, so a fresh process already has
three demo groups the frontend can render.
"""

from fastapi import FastAPI

from .errors import install_error_handlers
from .routers import auth, expenses, groups, participants, repayments
from .seed import seed_demo_data
from .store import LedgerStore

DESCRIPTION = """
Trip Ledger's ledger API. Group access is by link token in the path (public or
admin); finish, reopen, and delete additionally require a bearer session from
`POST /auth/login`. See `openapi.yaml` at the repository root for the contract.
"""


def create_app(store: LedgerStore | None = None) -> FastAPI:
    app = FastAPI(title="Trip Ledger API", version="0.1.0", description=DESCRIPTION)
    app.state.store = store if store is not None else seed_demo_data(LedgerStore())
    install_error_handlers(app)
    app.include_router(auth.router)
    app.include_router(groups.router)
    app.include_router(participants.router)
    app.include_router(expenses.router)
    app.include_router(repayments.router)
    return app


app = create_app()
