"""Liveness and readiness endpoints."""

from fastapi import APIRouter

router = APIRouter(tags=["System"])


@router.get("/health/live")
async def live() -> dict[str, object]:
    return {"success": True, "status": 200, "data": {"status": "ok", "service": "flytopay"}}


@router.get("/health/ready")
async def ready() -> dict[str, object]:
    return {"success": True, "status": 200, "data": {"status": "ready"}}
