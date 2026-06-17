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
    
    print("\nStep 2: Fetching Daily Pre-Compiled Briefing...")
    async with httpx.AsyncClient() as http_client:
        r = await http_client.get(
            f"{base_url}/api/v1/briefing/daily?farm_id={farm_id}",
            headers=headers
        )
        if r.status_code != 200:
            print(f"Daily Briefing retrieval failed: {r.text}")
            return
        briefing_res = r.json()
        
    print("\n=== DAILY BRIEFING RETRIEVED SUCCESSFULLY ===")
    print(f"Briefing ID:    {briefing_res.get('briefing_id')}")
    print(f"Source:         {briefing_res.get('source')}")
    print(f"Generated At:   {briefing_res.get('generated_at')}")
    print(f"Synthesis:      {briefing_res.get('synthesis')}")
    print(f"Yield Risk:     {briefing_res.get('sections', {}).get('yield_risk', {}).get('risk_band')}")
    print(f"Stress Momentum: {briefing_res.get('sections', {}).get('stress_momentum', {}).get('direction')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
