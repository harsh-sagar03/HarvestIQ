from typing import Annotated

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.day7_schemas import SyncBatchRequest, SyncBatchResponse
from app.services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("", response_model=SyncBatchResponse)
async def sync_outbox(
    payload: SyncBatchRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> SyncBatchResponse:
    service = SyncService(db)
    return await service.replay_batch(str(current_user["_id"]), payload)
