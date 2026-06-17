#!/usr/bin/env python3
import asyncio
import httpx
from pathlib import Path
import sys
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.core.config import get_settings

async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]
    
    # Fetch a real user and farm
    user_doc = await db.users.find_one({"phone": "+919876543210"})
    if not user_doc:
        print("User +919876543210 not found.")
        return
        
    farm_doc = await db.farms.find_one({"user_id": user_doc["_id"]})
    if not farm_doc:
        print("No farm found for the user.")
        return
        
    farm_id = str(farm_doc["_id"])
    farm_name = farm_doc.get("name")
    phone = "+919876543210"
    password = "Password123!"
    
    print(f"Target Real Farm: {farm_name} (ID: {farm_id})")
    print(f"Farmer Phone:      {phone}")
    
    base_url = "http://localhost:8000"
    
    print("\nStep 1: Authenticating Farmer...")
    async with httpx.AsyncClient() as http_client:
        r = await http_client.post(
            f"{base_url}/api/v1/auth/login",
            json={
                "phone": phone,
                "password": password
            }
        )
        if r.status_code != 200:
            print(f"Login failed: {r.text}")
            return
        token_data = r.json()
        token = token_data["access_token"]
        
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\nStep 2: Triggering SOS Panic Alert (FLOOD)...")
    payload = {
        "farm_id": farm_id,
        "emergency_type": "FLOOD",
        "latitude": 27.2152,
        "longitude": 77.5030
    }
    
    async with httpx.AsyncClient() as http_client:
        r = await http_client.post(
            f"{base_url}/api/v1/sos/trigger",
            headers=headers,
            json=payload
        )
        if r.status_code != 200:
            print(f"SOS Trigger failed: {r.text}")
            return
        sos_res = r.json()
        
    print("\n=== SOS PANIC ACTION TRIGGERED SUCCESSFULLY ===")
    print(f"Action ID:       {sos_res.get('action_id')}")
    print(f"Delivery Status: {sos_res.get('delivery_status')}")
    print(f"Plain Text Msg:  {sos_res.get('plain_text_message')}")
    print("Action Checklist:")
    for step in sos_res.get("checklist", []):
        print(f"  - {step}")
        
    # Verify in DB
    from bson import ObjectId
    action_doc = await db.sos_actions.find_one({"_id": ObjectId(sos_res.get("action_id"))})
    if action_doc:
        print("\n=== VERIFIED IN MONGODB ===")
        print(f"Saved Document ID: {action_doc['_id']}")
        print(f"Coordinates:       {action_doc.get('coordinates')}")
        print(f"Plain Text:        {action_doc.get('plain_text_message')}")
    else:
        print("\nWarning: Action document not found in MongoDB database.")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
