import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.constants.crop_stages import CropCycleStatus
from app.core.constants.disease import ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES
from app.core.constants.crop_types import normalize_crop_type
from app.core.exceptions import bad_gateway, unprocessable_entity
from app.integrations.gemini_client import OpenRouterClient
from app.models.day4_schemas import DiseaseDetectResponse
from app.services.deterministic_engine import confirm_disease_detection, normalize_disease_tag
from app.services.explainability_service import build_disease_explanation
from app.services.farm_access_service import get_owned_farm


class DiseaseDetectionService:
    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        gemini_client: Optional[OpenRouterClient] = None,
    ) -> None:
        self.db = db
        self.gemini_client = gemini_client or OpenRouterClient()
        self.settings = get_settings()
        self.allowed_regions = self._load_allowed_regions()

    async def detect(
        self,
        user_id: str,
        farm_id: str,
        image_bytes: bytes,
        content_type: str,
    ) -> DiseaseDetectResponse:
        if not image_bytes:
            raise unprocessable_entity("Image file is required")
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise unprocessable_entity("Image file exceeds maximum allowed size")
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise unprocessable_entity("Unsupported image type")

        farm = await get_owned_farm(self.db, farm_id, user_id)
        crop_type, cycle_status = await self._resolve_crop_type(farm_id)
        state = str(farm.get("state", "ALL"))

        try:
            vision_result = await self.gemini_client.detect_disease(
                image_bytes=image_bytes,
                mime_type=content_type,
                crop_type=crop_type,
                state=state,
            )
        except Exception as exc:
            print("DETECT_DISEASE_EXCEPTION =", repr(exc))
            raise bad_gateway(f"Disease detection failed: {exc}") from exc

        detected_disease = str(vision_result["disease"])
        confidence = float(vision_result["confidence"])
        disease_tag, deterministic_status = confirm_disease_detection(
            crop_type=crop_type,
            state=state,
            detected_disease=detected_disease,
            confidence=confidence,
            confidence_threshold=self.settings.disease_confidence_threshold,
            allowed_by_crop=self.allowed_regions,
        )

        now = datetime.now(timezone.utc)
        location = farm["location"]
        inputs = {
            "crop_type": crop_type,
            "state": state,
            "district": farm.get("district"),
            "detected_disease": normalize_disease_tag(detected_disease),
            "confidence": confidence,
            "deterministic_status": deterministic_status,
            "confidence_threshold": self.settings.disease_confidence_threshold,
        }
        explanation = build_disease_explanation(
            disease=disease_tag,
            confidence=confidence,
            deterministic_status=deterministic_status,
            primary_factor="DISEASE",
            inputs=inputs,
        )

        doc = {
            "user_id": ObjectId(user_id),
            "farm_id": ObjectId(farm_id),
            "crop_type": crop_type,
            "detected_disease": disease_tag,
            "confidence": confidence,
            "deterministic_status": deterministic_status,
            "location": location,
            "explanation": explanation,
            "created_at": now,
        }
        result = await self.db.disease_reports.insert_one(doc)
        report_id = str(result.inserted_id)

        upload_dir = Path(self.settings.disease_upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        extension = "jpg" if "jpeg" in content_type or content_type == "image/jpg" else content_type.split("/")[-1]
        image_path = upload_dir / f"{report_id}.{extension}"
        image_path.write_bytes(image_bytes)
        await self.db.disease_reports.update_one(
            {"_id": result.inserted_id},
            {"$set": {"image_storage_key": str(image_path)}},
        )

        return DiseaseDetectResponse(
            report_id=report_id,
            farm_id=farm_id,
            crop_type=crop_type,
            disease=disease_tag,
            confidence=confidence,
            deterministic_status=deterministic_status,
            explanation=explanation,
            cycle_status=cycle_status,
        )

    async def _resolve_crop_type(self, farm_id: str) -> tuple[str, str]:
        from app.services.farm_access_service import get_latest_relevant_crop_cycle
        cycle, cycle_status = await get_latest_relevant_crop_cycle(self.db, farm_id)
        return normalize_crop_type(cycle["crop_type"]), cycle_status

    @staticmethod
    def _load_allowed_regions() -> dict:
        path = Path(__file__).resolve().parents[2] / "data" / "disease_allowed_regions.json"
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
