from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.day4_schemas import DiseaseDetectResponse
from app.services.disease_detection_service import DiseaseDetectionService

router = APIRouter(prefix="/disease", tags=["disease"])


@router.post("/detect", response_model=DiseaseDetectResponse)
async def detect_disease(
    farm_id: Annotated[str, Form(...)],
    image: Annotated[UploadFile, File(...)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> DiseaseDetectResponse:
    content_type = image.content_type or "application/octet-stream"
    image_bytes = await image.read()
    db = get_database()
    service = DiseaseDetectionService(db)
    return await service.detect(
        user_id=str(current_user["_id"]),
        farm_id=farm_id,
        image_bytes=image_bytes,
        content_type=content_type,
    )
