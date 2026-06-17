#!/usr/bin/env python3
"""Run deployment smoke checks and record results in verification_logs."""

import asyncio
import sys
from pathlib import Path

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.services.verification_log_service import VerificationLogService  # noqa: E402


async def main() -> None:
    settings = get_settings()
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    environment = settings.environment

    checks: dict[str, str] = {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            health = await client.get(f"{base_url}/health")
            body = health.json()
            checks["health"] = "PASS" if health.status_code == 200 and body.get("db") == "ok" else "FAIL"
            checks["health_detail"] = str(body)
        except Exception as exc:
            checks["health"] = "FAIL"
            checks["health_detail"] = str(exc)

        try:
            demo = await client.get(f"{base_url}/api/v1/demo/initialize")
            checks["demo_initialize"] = "PASS" if demo.status_code == 200 else "FAIL"
        except Exception as exc:
            checks["demo_initialize"] = "FAIL"
            checks["demo_detail"] = str(exc)

    overall = "PASS" if all(v == "PASS" for k, v in checks.items() if k.endswith(("health", "demo_initialize"))) else "FAIL"

    client_mongo = AsyncIOMotorClient(settings.mongodb_uri)
    db = client_mongo[settings.mongodb_db_name]
    service = VerificationLogService(db)
    result = await service.record(
        event_type="DEPLOY_SMOKE",
        environment=environment,
        status=overall,
        details=checks,
    )
    client_mongo.close()

    print(f"Smoke verification: {overall}")
    print(f"Log ID: {result.log_id}")
    for key, value in checks.items():
        print(f"  {key}: {value}")
    sys.exit(0 if overall == "PASS" else 1)


if __name__ == "__main__":
    asyncio.run(main())
