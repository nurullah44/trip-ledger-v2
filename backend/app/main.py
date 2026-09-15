"""Trip Ledger API — FastAPI implementation of ../../openapi.yaml.

The database comes from `TRIP_LEDGER_DATABASE_URL` (SQLite by default; any URL
SQLAlchemy understands works). An empty database is seeded with demo groups so
the frontend has something to render immediately.
"""

from fastapi import FastAPI

from .database import Database
from .errors import install_error_handlers
from .routers import auth, expenses, groups, participants, repayments
from .seed import seed_if_empty
from .store import LedgerStore

DESCRIPTION = """
Trip Ledger's ledger API. Group access is by link token in the path (public or
admin); finish, reopen, and delete additionally require a bearer session from
`POST /auth/login`. See `openapi.yaml` at the repository root for the contract.

Storage is chosen by the `TRIP_LEDGER_DATABASE_URL` environment variable, so the
same server runs on SQLite today and another SQLAlchemy database later.
"""


def create_app(database: Database | None = None, *, seed: bool = True) -> FastAPI:
    app = FastAPI(title="Trip Ledger API", version="0.1.0", description=DESCRIPTION)
    app.state.db = database if database is not None else Database()
    app.state.db.create_all()
    if seed:
        with app.state.db.session() as session:
            seed_if_empty(LedgerStore(session))
    install_error_handlers(app)
    app.include_router(auth.router)
    app.include_router(groups.router)
    app.include_router(participants.router)
    app.include_router(expenses.router)
    app.include_router(repayments.router)
    return app


app = create_app()
