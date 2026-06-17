from app.integrations import gemini_client
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.constants.advisory import INTELLIGENCE_SNAPSHOT_VERSION
from app.core.constants.sos import (
    ALLOWED_EMERGENCY_TYPES,
    DELIVERY_LOGGED,
    DELIVERY_SMS_FAILED,
    DELIVERY_SMS_SENT,
    EMERGENCY_FLOOD,
    EMERGENCY_FROST,
    EMERGENCY_GENERAL,
    EMERGENCY_HEATWAVE,
)
from app.core.exceptions import unprocessable_entity
from app.models.day7_schemas import SosTriggerRequest, SosTriggerResponse
from app.services.context_compiler_service import ContextCompilerService


class SosService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.context_compiler = ContextCompilerService(db)
        self.settings = get_settings()
        print("TWILIO ENABLED =", self.settings.twilio_enabled)
    async def _safe_find_one(self, collection_name: str, query: dict) -> Optional[dict]:
        try:
            collection = getattr(self.db, collection_name, None)
            if collection is None:
                return None
            find_one_func = getattr(collection, "find_one", None)
            if find_one_func is None:
                return None
            res = find_one_func(query)
            if hasattr(res, "__await__"):
                return await res
            elif isinstance(res, dict):
                return res
            return None
        except Exception:
            return None

    async def trigger(self, user_id: str, payload: SosTriggerRequest) -> SosTriggerResponse:
        emergency_type = payload.emergency_type.strip().upper()
        if emergency_type not in ALLOWED_EMERGENCY_TYPES:
            raise unprocessable_entity(f"Unsupported emergency type: {payload.emergency_type}")

        # Look up farm details
        farm = await self._safe_find_one("farms", {"_id": ObjectId(payload.farm_id)})
        farm_name = (farm or {}).get("name", "Unknown Farm")
        state = (farm or {}).get("state", "Unknown State")
        district = (farm or {}).get("district", "Unknown District")

        # Look up user details
        user = await self._safe_find_one("users", {"_id": ObjectId(user_id)})
        user_name = (user or {}).get("name", "Unknown Farmer")
        phone = (user or {}).get("phone", "")

        snapshot = await self.context_compiler.compile_health_snapshot(user_id, payload.farm_id)
        core = snapshot.core

        checklist = self._build_checklist(
            emergency_type=emergency_type,
            stage=core.stage,
            fsi=core.fsi,
            fsi_classification=core.fsi_classification,
            yield_risk_band=core.yield_risk.risk_band,
            unread_alerts=snapshot.unread_alerts,
        )
        plain_text = self._build_plain_text_message(
            emergency_type=emergency_type,
            farm_id=payload.farm_id,
            farm_name=farm_name,
            state=state,
            district=district,
            user_name=user_name,
            phone=phone,
            checklist=checklist,
            health_band=snapshot.health_band,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )

        delivery_status = DELIVERY_LOGGED
        if self.settings.twilio_enabled:
            delivery_status = await self._attempt_sms(plain_text, user_id)

        coordinates = None
        if payload.latitude is not None and payload.longitude is not None:
            coordinates = {
                "type": "Point",
                "coordinates": [payload.longitude, payload.latitude],
            }

        triggered_at = datetime.now(timezone.utc)
        if getattr(payload, "captured_at", None):
            try:
                captured_str = payload.captured_at.replace("Z", "+00:00")
                triggered_at = datetime.fromisoformat(captured_str)
            except Exception:
                pass

        doc = {
            "user_id": ObjectId(user_id),
            "farm_id": ObjectId(payload.farm_id),
            "emergency_type": emergency_type,
            "coordinates": coordinates,
            "checklist": checklist,
            "plain_text_message": plain_text,
            "delivery_status": delivery_status,
            "intelligence_snapshot_version": INTELLIGENCE_SNAPSHOT_VERSION,
            "context_hash": None,
            "triggered_at": triggered_at,
        }
        result = await self.db.sos_actions.insert_one(doc)

        return SosTriggerResponse(
            action_id=str(result.inserted_id),
            farm_id=payload.farm_id,
            emergency_type=emergency_type,
            checklist=checklist,
            plain_text_message=plain_text,
            delivery_status=delivery_status,
            intelligence_snapshot_version=INTELLIGENCE_SNAPSHOT_VERSION,
            triggered_at=triggered_at,
        )

    async def _attempt_sms(self, message: str, user_id: str) -> str:
        user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        phone = str((user or {}).get("phone", ""))
        if not phone or not self.settings.twilio_account_sid:
            return DELIVERY_LOGGED
        try:
            import httpx

            url = (
                f"https://api.twilio.com/2010-04-01/Accounts/"
                f"{self.settings.twilio_account_sid}/Messages.json"
            )
            async with httpx.AsyncClient(timeout=15.0) as client:
                print("SMS TO =", phone)
                print("TWILIO FROM =", self.settings.twilio_from_number)
                response = await client.post(
                    url,
                    auth=(self.settings.twilio_account_sid, self.settings.twilio_auth_token),
                    data={
                        "To": phone,
                        "From": self.settings.twilio_from_number,
                        "Body": message[:1600],
                    },
                )
                response.raise_for_status()
                
                print("SMS SENT SUCCESSFULLY")
            return DELIVERY_SMS_SENT
        except Exception:
            return DELIVERY_SMS_FAILED

    @staticmethod
    def _build_checklist(
        emergency_type: str,
        stage: str,
        fsi: float,
        fsi_classification: str,
        yield_risk_band: str,
        unread_alerts: int,
    ) -> list[str]:
        steps: list[str] = [
            f"Current crop stage: {stage}. Field stress: {fsi_classification} (FSI {fsi:.2f}).",
            f"Yield risk band: {yield_risk_band}.",
        ]

        emergency_steps = {
            EMERGENCY_FLOOD: [
                "Contact nearest KVK (Krishi Vigyan Kendra) for recovery guidance.",
            ],
            EMERGENCY_FROST: [
                "Consult nearest KVK if frost damage becomes widespread.",
            ],
            EMERGENCY_HEATWAVE: [
                "Contact local KVK for heat stress mitigation recommendations.",
            ],
            EMERGENCY_GENERAL: [
                "Contact nearest KVK (Krishi Vigyan Kendra) or agriculture helpline.",
            ],
        }
        steps.extend(emergency_steps.get(emergency_type, emergency_steps[EMERGENCY_GENERAL]))
        return steps

    @staticmethod
    def _build_plain_text_message(
        emergency_type: str,
        farm_id: str,
        farm_name: str,
        state: str,
        district: str,
        user_name: str,
        phone: str,
        checklist: list[str],
        latitude: Optional[float],
        longitude: Optional[float],
        health_band: str,
    ) -> str:
        preview = "\n- " + "\n- ".join(checklist[:3])
        location_text = ""
        if latitude is not None and longitude is not None:
            location_text = (
                f"GPS: {latitude:.4f},{longitude:.4f}\n"
                f"https://maps.google.com/?q={latitude},{longitude}"
            )

        return (
            f"HarvestIQ SOS [{emergency_type}]\n\n"
            f"Farmer: {user_name} ({phone})\n"
            f"Farm: {farm_name}\n"
            f"District: {district}, {state}\n"
            f"Health: {health_band}\n"
            f"{location_text}\n\n"
            f"Actions:\n{preview}"
        )
