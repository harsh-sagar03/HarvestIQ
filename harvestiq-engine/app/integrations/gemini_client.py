import base64
import json
from typing import Optional

import httpx

from app.core.config import get_settings


class OpenRouterClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        text_model: Optional[str] = None,
    ):
        settings = get_settings()

        print("OPENROUTER FROM SETTINGS =", repr(getattr(settings, "openrouter_api_key", None)))
        print("GEMINI FROM SETTINGS =", repr(settings.gemini_api_key))
        self.api_key = (
            api_key
            or getattr(settings, "openrouter_api_key", "")
            or settings.gemini_api_key
        )

        print(
            "API KEY PREFIX =",
            self.api_key[:15] if self.api_key else "EMPTY"
        )
        print(
            "API KEY LENGTH =",
            len(self.api_key) if self.api_key else 0
        )

        self.model = model or "google/gemma-4-26b-a4b-it:free"
        self.text_model = text_model or "google/gemma-4-26b-a4b-it:free"

        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"

        print(
            f"[OpenRouterClient] Loaded. Vision={self.model} Text={self.text_model}"
        )

    async def detect_disease(
        self,
        image_bytes: bytes,
        mime_type: str,
        crop_type: str,
        state: str,
    ) -> dict:
        encoded = base64.b64encode(image_bytes).decode("utf-8")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "HarvestIQ",
        }

        prompt = (
            f"You are an agricultural crop disease detection system.\n"
            f"Crop: {crop_type}\n"
            f"State: {state}\n\n"
            f"Analyze the crop image and return ONLY valid JSON:\n"
            f'{{"crop_type":"{crop_type}","disease_tag":"DISEASE_NAME","confidence":0.95}}'
        )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{encoded}"
                            },
                        },
                    ],
                }
            ],
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.openrouter_url,
                headers=headers,
                json=payload,
                timeout=60.0,
            )

        print("OPENROUTER STATUS =", response.status_code)

        if response.status_code != 200:
            print("OPENROUTER ERROR BODY =", response.text)

        response.raise_for_status()

        data = response.json()

        content = data["choices"][0]["message"]["content"]

        parsed = json.loads(
            content.strip().replace("```json", "").replace("```", "")
        )

        return {
            "disease": parsed.get("disease_tag", "UNKNOWN"),
            "confidence": float(parsed.get("confidence", 0.0)),
        }

    async def synthesize_advisory(
        self,
        context_package: str,
        language: str,
        mitigation_locked: bool = False,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        system_text = (
            "You are an agricultural advisory assistant."
        )

        if mitigation_locked:
            system_text += (
                " Mitigation is locked. Do not invent treatments."
            )

        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": system_text
                    }
                ]
            },
            "contents": [
                {
                    "parts": [
                        {
                            "text": context_package
                        }
                    ]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.text_model}:generateContent",
                json=payload,
                timeout=60.0,
            )

        response.raise_for_status()

        data = response.json()

        return data["candidates"][0]["content"]["parts"][0]["text"]