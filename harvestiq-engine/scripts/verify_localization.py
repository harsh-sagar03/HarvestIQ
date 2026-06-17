#!/usr/bin/env python3
import sys
from pathlib import Path
from bson import ObjectId

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from app.main import create_app
from app.api.deps import get_current_user

USER_ID = str(ObjectId())

def main() -> None:
    print("=== Localization & Translation Verification ===")

    # Initialize app
    app = create_app()

    # Bypass authentication dependency
    async def fake_user():
        return {
            "_id": ObjectId(USER_ID),
            "preferred_lang": "hi",
            "role": "FARMER",
        }
    app.dependency_overrides[get_current_user] = fake_user

    # Use TestClient context manager to trigger lifespan events (Mongo connection)
    with TestClient(app) as client:
        # 1. Check Hindi Translation for Error
        print("\nTesting Query Validation Error Translation in Hindi...")
        res_hi = client.post(
            "/api/v1/advisory/ask",
            json={"farm_id": "658145265487123985145624", "query": "   "},
            headers={"Accept-Language": "hi"},
        )
        print(f"Status Code: {res_hi.status_code}")
        print(f"Response JSON: {res_hi.json()}")
        assert res_hi.json().get("detail") == "प्रश्न आवश्यक है", "Hindi translation failed!"

        # 2. Check English Fallback
        print("\nTesting Query Validation Error Fallback in English...")
        res_en = client.post(
            "/api/v1/advisory/ask",
            json={"farm_id": "658145265487123985145624", "query": "   "},
            headers={"Accept-Language": "en"},
        )
        print(f"Status Code: {res_en.status_code}")
        print(f"Response JSON: {res_en.json()}")
        assert res_en.json().get("detail") == "Query is required", "English fallback failed!"

    print("\n=== Localization verification passed successfully! ===")

if __name__ == "__main__":
    main()
