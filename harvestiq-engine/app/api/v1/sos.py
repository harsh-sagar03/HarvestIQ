from typing import Annotated

from fastapi import APIRouter, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.api.v1.auth import limiter
from app.core.constants.sos import SOS_RATE_LIMIT
from app.core.database import get_database
from app.models.day7_schemas import SosTriggerRequest, SosTriggerResponse
from app.services.sos_service import SosService

router = APIRouter(prefix="/sos", tags=["sos"])


def _sos_rate_limit_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return f"sos:{auth[7:22]}"
    return f"sos-ip:{request.client.host if request.client else 'unknown'}"


@router.post("/trigger", response_model=SosTriggerResponse)
@limiter.limit(SOS_RATE_LIMIT, key_func=_sos_rate_limit_key)
async def trigger_sos(
    request: Request,
    payload: SosTriggerRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> SosTriggerResponse:
    service = SosService(db)
    return await service.trigger(str(current_user["_id"]), payload)
