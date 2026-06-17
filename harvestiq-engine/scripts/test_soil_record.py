#!/usr/bin/env python3
import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]
    
    user_doc = await db.users.find_one({"phone": "+919876543210"})
    if not user_doc:
        print("User not found")
        return
        
    farm_doc = await db.farms.find_one({"user_id": user_doc["_id"]})
    if not farm_doc:
        print("Farm not found")
        return
        
    farm_id = str(farm_doc["_id"])
    print(f"Farm ID: {farm_id}")
    
    # Authenticate
    async with httpx.AsyncClient() as http_client:
        r = await http_client.post(
            "http://localhost:8000/api/v1/auth/login",
            json={"phone": "+919876543210", "password": "Password123!"}
        )
        if r.status_code != 200:
            print("Login failed:", r.text)
            return
        token = r.json()["access_token"]
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try POST /api/v1/soil/records
    payload = {
        "farm_id": farm_id,
        "nitrogen": 80,
        "phosphorus": 18,
        "potassium": 220,
        "ph": 6.8,
        "organic_carbon": 0.55,
        "electrical_conductivity": 0.8
    }
    
    print("\nSending POST request...")
    async with httpx.AsyncClient() as http_client:
        r = await http_client.post(
            "http://localhost:8000/api/v1/soil/records",
            headers=headers,
            json=payload
        )
        print("POST Response Status:", r.status_code)
        print("POST Response Body:", r.text)
        
    print("\nSending GET request...")
    async with httpx.AsyncClient() as http_client:
        r = await http_client.get(
            f"http://localhost:8000/api/v1/soil/records/latest?farm_id={farm_id}",
            headers=headers
        )
        print("GET Response Status:", r.status_code)
        print("GET Response Body:", r.text)
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
