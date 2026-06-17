from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.engine_schemas import (
    AlertListResponse,
    AlertResponse,
    TriggerEvaluationRequest,
    TriggerEvaluationResponse,
)
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    current_user: Annotated[dict, Depends(get_current_user)],
    unread_only: Annotated[bool, Query()] = False,
    farm_id: Annotated[Optional[str], Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AlertListResponse:
    db = get_database()
    service = AlertService(db)
    return await service.list_for_user(
        str(current_user["_id"]),
        unread_only=unread_only,
        farm_id=farm_id,
        limit=limit,
    )


@router.post("/trigger-evaluation", response_model=TriggerEvaluationResponse)
async def trigger_alert_evaluation(
    payload: TriggerEvaluationRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> TriggerEvaluationResponse:
    db = get_database()
    service = AlertService(db)
    return await service.trigger_evaluation(str(current_user["_id"]), payload)


@router.put("/{alert_id}/read", response_model=AlertResponse)
async def mark_alert_read(
    alert_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> AlertResponse:
    db = get_database()
    service = AlertService(db)
    return await service.mark_read(alert_id, str(current_user["_id"]))
