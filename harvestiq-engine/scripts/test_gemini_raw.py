import asyncio
import os
from pathlib import Path
import httpx
from dotenv import load_dotenv

# Load env variables from harvestiq-engine/.env
ROOT = Path(__file__).resolve().parents[1]
dotenv_path = ROOT / ".env"
load_dotenv(dotenv_path=dotenv_path, override=True)

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"Loaded API key from env: {api_key}")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Hello, respond with a short message."}
                ]
            }
        ]
    }
    
    print("Sending POST request to Gemini API...")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload)
            print(f"Status Code: {response.status_code}")
            print("Response Headers:")
            for k, v in response.headers.items():
                print(f"  {k}: {v}")
            print("Response Body:")
            print(response.text)
    except Exception as exc:
        print(f"Request failed with exception: {exc}")

if __name__ == "__main__":
    asyncio.run(main())
