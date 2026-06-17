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
    
    print("\nStep 2: Querying Farmer Health Card Endpoint...")
    async with httpx.AsyncClient() as http_client:
        r = await http_client.get(
            f"{base_url}/api/v1/health-card?farm_id={farm_id}",
            headers=headers
        )
        if r.status_code != 200:
            print(f"Health Card retrieval failed: {r.text}")
            return
        health_res = r.json()
        
    print("\n=== HEALTH CARD RETRIEVED SUCCESSFULLY ===")
    print(f"Crop Type:       {health_res.get('crop_type')}")
    print(f"Stage:           {health_res.get('stage')}")
    print(f"FSI Index:       {health_res.get('fsi')}")
    print(f"Classification:  {health_res.get('fsi_classification')}")
    print(f"Soil Health Idx: {health_res.get('soil_health_index')}")
    print(f"Health Score:    {health_res.get('health_score')}")
    print(f"Health Band:     {health_res.get('health_band')}")
    print(f"Summary:         {health_res.get('explanation', {}).get('summary')}")
    
    print("\nStep 3: Querying Hybrid RAG Advisory Endpoint...")
    payload = {
        "farm_id": farm_id,
        "query": "Is heat stress impacting my wheat in Rajasthan?"
    }
    async with httpx.AsyncClient() as http_client:
        r = await http_client.post(
            f"{base_url}/api/v1/advisory/ask",
            headers=headers,
            json=payload
        )
        if r.status_code != 200:
            print(f"Advisory Ask failed: {r.text}")
            return
        advisory_res = r.json()
        
    print("\n=== HYBRID RAG ADVISORY RETRIEVED SUCCESSFULLY ===")
    print(f"Advisory ID:     {advisory_res.get('advisory_id')}")
    print(f"Synthesis Output:\n{advisory_res.get('synthesis')}")
    print(f"Citations Count: {len(advisory_res.get('citations', []))}")
    for idx, cit in enumerate(advisory_res.get('citations', [])):
        print(f"  [{idx+1}] Source: {cit.get('source')} | Title: {cit.get('title')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
