"""Password hashing and bearer-session plumbing.

Passwords are stored as salted PBKDF2-HMAC-SHA256 digests; session tokens are
random and stored hashed, so a memory dump of the store yields neither.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Final

from fastapi import Request

from .errors import LedgerError
from .models import Session

PBKDF2_ALGORITHM: Final = "sha256"
PBKDF2_ITERATIONS: Final = 210_000
SESSION_TTL: Final = timedelta(hours=12)


def hash_password(password: str, *, salt: str | None = None, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGORITHM, password.encode(), bytes.fromhex(salt), iterations)
    return f"pbkdf2_{PBKDF2_ALGORITHM}${iterations}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, expected = stored.split("$")
        if scheme != f"pbkdf2_{PBKDF2_ALGORITHM}":
            return False
        digest = hashlib.pbkdf2_hmac(PBKDF2_ALGORITHM, password.encode(), bytes.fromhex(salt), int(iterations))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), expected)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def session_expiry(now: datetime) -> datetime:
    return now + SESSION_TTL


def new_session(token: str, expires_at: datetime) -> Session:
    return Session(access_token=token, token_type="bearer", expires_at=expires_at)


def bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        raise LedgerError("unauthorized", "Sign in again to continue.")
    return value.strip()


def require_session(request: Request) -> str:
    """FastAPI dependency: returns the authenticated user id or raises 401."""
    token = bearer_token(request)
    return request.app.state.store.resolve_session(token)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
