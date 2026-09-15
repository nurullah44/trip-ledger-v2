"""The one error type every endpoint raises, mapped to the contract's HTTP codes."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .models import LedgerErrorCode

STATUS_BY_CODE: dict[LedgerErrorCode, int] = {
    "validation": 400,
    "unauthorized": 401,
    "forbidden": 403,
    "not_found": 404,
    "conflict": 409,
    "group_locked": 409,
}


class LedgerError(Exception):
    """Raised by the store and auth layer; serialized as `{code, message}`."""

    def __init__(self, code: LedgerErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    @property
    def status_code(self) -> int:
        return STATUS_BY_CODE[self.code]


def error_body(code: LedgerErrorCode, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


async def ledger_error_handler(_: Request, exc: LedgerError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message))


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Turn FastAPI's 422 body into the contract's 400 `validation` body."""
    errors = exc.errors()
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
        message = f"{location}: {first.get('msg', 'invalid value')}" if location else str(first.get("msg"))
    else:
        message = "The request is malformed."
    return JSONResponse(status_code=400, content=error_body("validation", message))


async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code: LedgerErrorCode = "not_found" if exc.status_code == 404 else "validation"
    return JSONResponse(status_code=exc.status_code, content=error_body(code, str(exc.detail)))


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(LedgerError, ledger_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
