from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from app.models.day7_schemas import SosTriggerRequest
from app.services.context_compiler_service import HealthCompiledResult
from app.services.sos_service import SosService


@pytest.mark.asyncio
async def test_sos_builds_deterministic_checklist(monkeypatch) -> None:
    db = MagicMock()
    db.sos_actions.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    db.users.find_one = AsyncMock(return_value=None)

    service = SosService(db)
    core = MagicMock()
    core.stage = "Tillering"
    core.fsi = 0.82
    core.fsi_classification = "HIGH_STRESS"
    core.yield_risk.risk_band = "HIGH"
    snapshot = HealthCompiledResult(
        core=core,
        health_score=42.0,
        health_band="POOR",
        nearby_radar_high_count=1,
        unread_alerts=2,
        explainability={},
        intelligence_snapshot_version="v3",
    )
    monkeypatch.setattr(service.context_compiler, "compile_health_snapshot", AsyncMock(return_value=snapshot))

    result = await service.trigger(
        str(ObjectId()),
        SosTriggerRequest(farm_id=str(ObjectId()), emergency_type="FLOOD"),
    )

    assert result.emergency_type == "FLOOD"
    assert len(result.checklist) >= 3
    assert "HIGH_STRESS" in result.checklist[0]
    assert result.delivery_status == "LOGGED"
    assert result.intelligence_snapshot_version == "v3"
    db.sos_actions.insert_one.assert_awaited_once()


def test_sos_checklist_includes_frost_steps() -> None:
    steps = SosService._build_checklist(
        emergency_type="FROST",
        stage="Flowering",
        fsi=0.6,
        fsi_classification="MEDIUM_STRESS",
        yield_risk_band="MEDIUM",
        unread_alerts=0,
    )
    assert any("frost" in step.lower() for step in steps)
