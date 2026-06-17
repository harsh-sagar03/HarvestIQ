This is the complete, build-ready implementation blueprint for **HarvestIQ**. It is structured for direct ingestion into Cursor, allowing you to use Claude 3.5 Sonnet or Gemini 2.5 Pro to generate the boilerplate file-by-file.

---

## 1. Complete Project Folder Structure

This unified monolithic repository layout separates your Next.js PWA frontend and your FastAPI backend cleanly while maintaining shared configuration schemas.

```text
harvestiq-monorepo/
├── harvestiq-client/             # Next.js 14+ Frontend (Vercel)
│   ├── public/
│   │   ├── workers/
│   │   │   └── sync-worker.js    # Background sync & network interceptor
│   │   ├── icons/
│   │   └── manifest.json         # PWA Configuration metadata
│   ├── src/
│   │   ├── app/                  # App Router
│   │   │   ├── layout.tsx        # Providers (Auth, React Query, Theme)
│   │   │   ├── page.tsx          # Dashboard / Farmer Health Card
│   │   │   ├── auth/
│   │   │   │   └── page.tsx      # Login / Registration split page
│   │   │   ├── advisory/
│   │   │   │   └── page.tsx      # Chat UI + Voice Interface
│   │   │   └── disease/
│   │   │       └── page.tsx      # Camera capture & Disease Radar Map
│   │   ├── components/
│   │   │   ├── ui/               # Radix-backed ShadCN components
│   │   │   ├── WeatherCard.tsx
│   │   │   ├── HealthCard.tsx
│   │   │   └── RadarMap.tsx
│   │   ├── hooks/
│   │   │   ├── useIndexedDB.ts   # Local CRUD interactions wrapper
│   │   │   └── useOnlineStatus.ts# Reactive window network listener
│   │   ├── lib/
│   │   │   ├── db.ts             # 'idb' initialization & structural schema
│   │   │   └── store.ts          # Zustand state machines (Auth, Synced Outbox)
│   ├── package.json
│   └── tsconfig.json
│
└── harvestiq-engine/             # FastAPI Backend Core (Render)
    ├── app/
    │   ├── main.py               # Application entry point, CORS, Rate Limiters
    │   ├── api/
    │   │   └── v1/
    │   │       ├── auth.py       # JWT Issuance & Registration handlers
    │   │       ├── advisory.py   # RAG Context processing gateway
    │   │       ├── disease.py    # Vision verification & clustering engine
    │   │       └── metrics.py    # GDD & FSI execution modules
    │   ├── core/
    │   │   ├── config.py         # Environmental variables validations
    │   │   ├── security.py       # Password cryptographic functions & JWT decoders
    │   │   └── database.py       # Client instances (Motor MongoDB & ChromaDB)
    │   ├── models/               # Strict Pydantic Verification models
    │   │   ├── user_schemas.py
    │   │   ├── farm_schemas.py
    │   │   └── engine_schemas.py
    │   └── services/             # Deterministic logic files
    │       ├── deterministic_engine.py # Pure python math (FSI, GDD)
    │       ├── rag_service.py    # Chroma DB similarity matrix matchers
    │       └── gemini_client.py  # LLM API transport structures
    ├── requirements.txt
    └── Dockerfile

```

---

## 2. Production MongoDB Schema Models (Pydantic v2)

These schemas use Pydantic to enforce type safety in FastAPI before records reach MongoDB Atlas.

### `models/user_schemas.py`

```python
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

class UserRegisterSchema(BaseModel):
    phone: str = Field(..., pattern=r"^\+?[1-9]\d{1,14}$")
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2, max_length=50)
    preferred_lang: str = Field("hi", description="ISO 639-1 language codes")

class UserInDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    phone: str
    password_hash: str
    name: str
    role: str = "FARMER"
    preferred_lang: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

```

### `models/farm_schemas.py`

```python
from pydantic import BaseModel, Field
from typing import List, Tuple
from datetime import datetime
from .user_schemas import PyObjectId

class GeoJSONPolygon(BaseModel):
    type: str = Field("Polygon", pattern="^Polygon$")
    coordinates: List[List[Tuple[float, float]]] # [[(lon, lat), (lon, lat), ...]]

class FarmCreateSchema(BaseModel):
    name: str = Field(..., min_length=1)
    boundary: GeoJSONPolygon
    soil_type: str = Field(..., description="CLAY | SANDY | LOAM | SILT")

class FarmInDB(FarmCreateSchema):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

```

### `models/engine_schemas.py`

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .user_schemas import PyObjectId

class CropCycleCreate(BaseModel):
    farm_id: str
    crop_type: str
    sowing_date: datetime

class CropCycleInDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    farm_id: PyObjectId
    crop_type: str
    sowing_date: datetime
    current_gdd: float = 0.0
    status: str = "ACTIVE"
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DiseaseReportCreate(BaseModel):
    farm_id: str
    image_base64: str
    latitude: float
    longitude: float

class StressLogEntry(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    farm_id: PyObjectId
    stress_score: float = Field(..., ge=0.0, le=1.0)
    primary_factor: str # THERMAL | MOISTURE | COMBINED
    calculated_at: datetime = Field(default_factory=datetime.utcnow)

```

---

## 3. Strict API Contracts

### Authentication & Profiles

* **`POST /api/v1/auth/register`**
* *Payload:* `UserRegisterSchema`
* *Response (201):* `{"status": "success", "user_id": "65cb4f..."}`


* **`POST /api/v1/auth/login`**
* *Payload:* `{"username": "+91XXXXXXXXXX", "password": "secure_password"}` (OAuth2 Password Flow format)
* *Response (200):* `{"access_token": "eyJhbG...", "token_type": "bearer", "refresh_token": "eyJjd..."}`



### Agricultural Core & Analytics

* **`POST /api/v1/farms`**
* *Headers:* `Authorization: Bearer <token>`
* *Payload:* `FarmCreateSchema`
* *Response (201):* `{"id": "65cb5a...", "status": "farm_persisted"}`


* **`GET /api/v1/weather/forecast`**
* *Query Params:* `farm_id` (string, required)
* *Response (200):* ```json
{
"current": { "temp": 38.5, "humidity": 45 },
"source": "CACHE_HIT",
"cached_at": "2026-06-10T22:30:00Z"
}
```

```




* **`GET /api/v1/stress-index/{farm_id}`**
* *Response (200):* `{"farm_id": "65cb5a", "fsi": 0.42, "classification": "MEDIUM_STRESS", "timestamp": "2026-06-10T23:00:00Z"}`



### Intelligent Advisory & Vision

* **`POST /api/v1/disease/detect`**
* *Payload:* `DiseaseReportCreate`
* *Response (200):*
```json
{
  "pathogen_identified": "Tomato Late Blight",
  "confidence": 0.942,
  "deterministic_treatment_id": "TREAT_BLIGHT_04"
}

```




* **`POST /api/v1/advisory/ask`**
* *Payload:* `{"query": "Why are my leaves curling?", "farm_id": "65cb5a"}`
* *Response (200):*
```json
{
  "synthesis": "Your leaves are curling primarily due to high thermal stress (FSI: 0.82)...",
  "explainability": {
    "triggered_rules": ["RULE_THERMAL_HIGH_38"],
    "data_points": { "temperature": 39.1, "soil_moisture": 0.12 }
  },
  "citations": ["Govt Extension Leaflet #14 - Heat Mitigation"]
}

```





---

## 4. 7-Day Agile Execution Backlog

This checklist can be copied directly into your task tracker or system prompts to guide development day-by-day.

### Day 1: Authentication & Workspace Initialization

* [ ] Initialize FastAPI project with dependency configuration requirements in `requirements.txt`.
* [ ] Initialize Next.js 14 template inside `harvestiq-client/` using Tailwind CSS and TypeScript.
* [ ] Set up the MongoDB connection layer using `motor.motor_asyncio`.
* [ ] Implement user registration and login password verification routes via `jose` and `passlib`.
* [ ] Set up global application access context routing layouts inside the client workspace.

### Day 2: Farm Models & Crop Stage Tracking Engine

* [ ] Map 2D spatial coordinate tracking indexes on the MongoDB `Farms` collection configuration.
* [ ] Implement farm boundary logging API endpoints.
* [ ] Write the deterministic $GDD$ heat calculation engine tracking logic.
* [ ] Configure automatic stage calculation routes utilizing cumulative thermal metrics data inputs.
* [ ] Build baseline client application panels displaying current environmental tracking records.

### Day 3: Stress Calculators & Client Sync Interceptors

* [ ] Build mathematical calculations mapping operational environmental indices ($FSI$).
* [ ] Initialize IndexedDB client databases inside the frontend directory workspace.
* [ ] Code a global fetch fetch state handler fallback route to capture failed transmission requests.
* [ ] Write transaction parsing synchronization gateways (`POST /api/v1/sync`) for processing replayed connection elements.
* [ ] Build out real-time critical message alerts formatting frameworks inside database registers.

### Day 4: Vector Store Seeding & Photo Pipeline Tasks

* [ ] Build a vector indexing pipeline mapping local reference articles directly onto ChromaDB.
* [ ] Construct targeted category metadata filters to slice vector matching query layers.
* [ ] Connect multi-modal external processing layers (Gemini Vision API) to accept uploaded image buffers safely.
* [ ] Set up user validation parameters managing nutritional soil indicator forms.
* [ ] Create camera capture component layout blocks on frontend workspace files.

### Day 5: Advisory Processing & Incident Aggregators

* [ ] Build the structural framework that compiles local real-time metrics data vectors directly into clear markdown context blocks.
* [ ] Implement system safety directives restricting target conversational generations exclusively to explicit context boundaries.
* [ ] Code a scheduled map plotting calculator tracking recurring local disease outbreak frequencies.
* [ ] Integrate recording components linking microphone audio signals to input strings.
* [ ] Configure dynamic dialect conversion layers supporting localized interface variants.

### Day 6: Predictive Planners & Optimization Dashboards

* [ ] Write deterministic safety parameter matrix rules managing agricultural input actions (spraying, watering).
* [ ] Implement morning batch consolidation routines aggregating warning logs and trading metrics.
* [ ] Build standard application dashboard layouts (`FarmerHealthCard`) assembling comprehensive telemetry variables.
* [ ] Code interactive target value simulation tools using responsive configuration inputs.
* [ ] Connect live commodity valuation matrices directly onto operational workspace modules.

### Day 7: Operational Polish, Validation & Hardening Steps

* [ ] Apply secure header configurations and strict cross-origin resource rules onto routing endpoints.
* [ ] Write local mock data structures mapping core functions safely inside decoupled fallback environments.
* [ ] Build asset loading specifications matching target Progressive Web Application criteria configurations.
* [ ] Set up container configurations to compile and publish backend elements onto hosting environments.
* [ ] Verify execution behavior patterns under artificial low-bandwidth constraints.

---

## 5. Implementation Prompt Example for Cursor

When building a specific section (e.g., the Advisory Module on Day 5), feed this exact prompt pattern into Cursor to maintain strict separation of concerns:

```text
Context: We are on Day 5 of building HarvestIQ. 
Task: Implement the API endpoint `POST /api/v1/advisory/ask`.

Strict Rules:
1. Do NOT let Gemini make decisions. 
2. Fetch real-time data from MongoDB (Farms, CropCycles, StressLogs) based on the farm_id.
3. Query ChromaDB for vector matches using the user's query text.
4. Construct a strict Markdown text string containing this data (The Context Package).
5. Pass this Context Package to the Gemini API with a system instruction: "Synthesize this context into a clear natural language answer. Do not hallucinate or add outside information. If the context does not contain the answer, state that you do not know based on current field data."
6. Return the synthesis, the raw deterministic data used, and the citations.

Generate the code for `app/api/v1/advisory.py` and `app/services/rag_service.py`.

```