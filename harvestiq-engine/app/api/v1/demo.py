import json
from pathlib import Path

from fastapi import APIRouter, Request

from app.api.v1.auth import limiter
from app.models.day7_schemas import DemoInitializeResponse

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_MANIFEST_PATH = Path(__file__).resolve().parents[3] / "data" / "demo_manifest.json"


@router.get("/initialize", response_model=DemoInitializeResponse)
@limiter.limit("10/hour")
async def initialize_demo(request: Request) -> DemoInitializeResponse:
    with DEMO_MANIFEST_PATH.open(encoding="utf-8") as handle:
        manifest = json.load(handle)
    return DemoInitializeResponse(**manifest)
