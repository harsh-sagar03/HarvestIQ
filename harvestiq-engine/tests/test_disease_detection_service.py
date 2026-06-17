from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.integrations.gemini_client import OpenRouterClient
from app.services.disease_detection_service import DiseaseDetectionService

FARM_ID = str(ObjectId())
USER_ID = str(ObjectId())
CYCLE_ID = ObjectId()


@pytest.mark.asyncio
async def test_empty_image_returns_422() -> None:
    service = DiseaseDetectionService(MagicMock())
    with pytest.raises(HTTPException) as exc:
        await service.detect(USER_ID, FARM_ID, b"", "image/jpeg")
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_gemini_failure_returns_502(monkeypatch, tmp_path) -> None:
    db = MagicMock()
    db.crop_cycles.find_one = AsyncMock(
        return_value={"_id": CYCLE_ID, "crop_type": "WHEAT", "status": "ACTIVE"}
    )

    async def fake_owned(_db, _farm_id, _user_id):
        return {
            "_id": ObjectId(FARM_ID),
            "state": "Rajasthan",
            "district": "Bharatpur",
            "location": {"type": "Point", "coordinates": [77.5, 27.2]},
        }

    monkeypatch.setattr("app.services.disease_detection_service.get_owned_farm", fake_owned)
    monkeypatch.setattr(
        "app.services.disease_detection_service.get_settings",
        lambda: MagicMock(disease_confidence_threshold=0.70, disease_upload_dir=str(tmp_path)),
    )

    gemini = MagicMock(spec=OpenRouterClient)
    gemini.detect_disease = AsyncMock(side_effect=RuntimeError("network down"))

    service = DiseaseDetectionService(db, gemini_client=gemini)
    with pytest.raises(HTTPException) as exc:
        await service.detect(USER_ID, FARM_ID, b"abc", "image/jpeg")
    assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_confirmed_detection_persists_report(monkeypatch, tmp_path) -> None:
    db = MagicMock()
    db.crop_cycles.find_one = AsyncMock(
        return_value={"_id": CYCLE_ID, "crop_type": "WHEAT", "status": "ACTIVE"}
    )
    db.disease_reports.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    db.disease_reports.update_one = AsyncMock()

    async def fake_owned(_db, _farm_id, _user_id):
        return {
            "_id": ObjectId(FARM_ID),
            "state": "Rajasthan",
            "district": "Bharatpur",
            "location": {"type": "Point", "coordinates": [77.5, 27.2]},
        }

    monkeypatch.setattr("app.services.disease_detection_service.get_owned_farm", fake_owned)
    monkeypatch.setattr(
        "app.services.disease_detection_service.get_settings",
        lambda: MagicMock(disease_confidence_threshold=0.70, disease_upload_dir=str(tmp_path)),
    )

    gemini = MagicMock(spec=OpenRouterClient)
    gemini.detect_disease = AsyncMock(return_value={"disease": "WHEAT_RUST", "confidence": 0.92})

    service = DiseaseDetectionService(db, gemini_client=gemini)
    result = await service.detect(USER_ID, FARM_ID, b"fake-image", "image/jpeg")

    assert result.deterministic_status == "CONFIRMED"
    assert result.disease == "WHEAT_RUST"
    assert result.explanation.primary_factor == "DISEASE"
    db.disease_reports.insert_one.assert_called_once()
