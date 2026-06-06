"""
Global middleware for exception handling, logging, and tenant lifecycle.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
import logging
import traceback

from beanie import PydanticObjectId

logger = logging.getLogger("app")

# Endpoints that are never blocked, even for suspended tenants.
_TENANT_ALLOWLIST = {
    "/auth/login",
    "/auth/me",
    "/auth/change-password",
    "/auth/register",
    "/",
    "/docs",
    "/openapi.json",
    "/redoc",
}


async def exception_handler_middleware(request: Request, call_next):
    """Catch-all exception handler to ensure consistent error responses."""
    try:
        return await call_next(request)
    except ValidationError as e:
        logger.error(f"Validation Error: {e.json()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=jsonable_encoder({"detail": e.errors(), "message": "Input validation failed"}),
        )
    except Exception as e:
        logger.error(f"Unhandled Exception: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "message": "An internal server error occurred",
                "detail": str(e) if not request.app.debug else traceback.format_exc()
            },
        )


async def tenant_status_middleware(request: Request, call_next):
    """Block requests for suspended/cancelled tenants.

    Suspended tenants may still log in (so they can see the suspension) but
    all other endpoints return HTTP 402 Payment Required.
    """
    from app.models.user import User
    from app.models.tenant import Tenant

    path = request.url.path
    if path.startswith("/platform") or path.startswith("/uploads") or path.startswith("/static"):
        return await call_next(request)

    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return await call_next(request)
    token = auth.split(" ", 1)[1].strip()
    from app.auth.jwt_handler import decode_access_token
    payload = decode_access_token(token)
    if not payload or payload.get("aud") == "platform":
        return await call_next(request)

    sub = payload.get("sub")
    if not sub:
        return await call_next(request)
    try:
        oid = PydanticObjectId(sub)
    except Exception:
        return await call_next(request)
    user = await User.get(oid)
    if not user or user.tenant_id is None:
        return await call_next(request)

    # Strip trailing slashes for allowlist match
    bare = path.rstrip("/")
    if bare in _TENANT_ALLOWLIST or path in _TENANT_ALLOWLIST:
        return await call_next(request)

    tenant = await Tenant.get(user.tenant_id)
    if not tenant:
        return await call_next(request)
    if tenant.tenant_status in {"suspended", "cancelled"}:
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={
                "message": "Tenant access is currently restricted.",
                "tenant_status": tenant.tenant_status,
                "reason": tenant.suspended_reason,
            },
        )
    return await call_next(request)

