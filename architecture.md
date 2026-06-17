## Executive Architectural Principles

HarvestIQ is a deterministic agricultural intelligence platform. **Gemini is strictly a translation, synthesis, and sensory layer.** All calculations, risk assessments, agronomic stages, and rules live inside the FastAPI core logic.

```
       [ Client Layers: Next.js PWA / Voice / Vision ]
                             │
                             ▼
               [ API Gateway / FastAPI Core ]
                             │
       ┌─────────────────────┴─────────────────────┐
       ▼                                           ▼
[ Deterministic Engines ]                [ Generative / Translation ]
 - Crop Stage Engine                      - Gemini 2.5 Pro (Synthesis)
 - Field Stress Index                     - Gemini Vision (Disease)
 - Rule-Based Expert System               - Whisper / TTS (Voice)
       │                                           │
       └─────────────────────┬─────────────────────┘
                             ▼
              [ Data: MongoDB + ChromaDB ]

```

---

## Complete System Architecture & High-Level Diagram

```
+-----------------------------------------------------------------------------------+
|                                NEXT.JS CLIENT PWA                                 |
|  [Components: ShadCN + Tailwind] [State: Zustand] [Local Storage: IndexedDB]      |
+-----------------------------------------------------------------------------------+
                                  │               ▲
                    HTTPS / JSON  │               │  Server-Sent Events / Push
                                  ▼               │
+-----------------------------------------------------------------------------------+
|                               FASTAPI BACKEND CORE                                |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  |    AUTH & PERMISSIONS   |  |   DETERMINISTIC ENGINES  |  |    AI ADVISORY   |  |
|  |  JWT / OAuth2 / Roles   |  |   Crop Stage / Stress    |  |  Context / RAG   |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  |     ALERT ENGINE        |  |   CACHE & AGGREGATION    |  |  EXTERNAL APIS   |  |
|  |  Celery / Background    |  |   Weather / Heatmaps     |  | OpenWeather/Agri |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
+-----------------------------------------------------------------------------------+
                                  │               │
            Mongoose-style BSON   │               │  Vector Embeddings
                                  ▼               ▼
+------------------------------------+         +------------------------------------+
|        MONGODB ATLAS CLUSTER       |         |        CHROMADB VECTOR STORE       |
|  (Transactional, Analytics, Logs)   |         |    (Agronomic KB & Policy Docs)    |
+------------------------------------+         +------------------------------------+

```

---

## Core System Architecture Details

### Authentication Architecture

* **Mechanism:** Stateless **JWT Bearer Tokens** stored in client `HttpOnly` cookies for web sessions, and short-lived tokens in memory for the PWA client with an encrypted `Refresh Token` in IndexedDB.
* **Roles:** `FARMER`, `AGRONOMIST`, `ADMIN`.
* **Offline Mode:** When offline, the PWA checks the last valid JWT signature metadata cached securely in IndexedDB to allow read-only access to localized cached data.

### Notification & Alert Architecture

* **Real-time Delivery:** Server-Sent Events (SSE) via FastAPI for in-app live alerts.
* **Asynchronous Processing:** Background tasks parse rules (e.g., Temperature > 40°C) and trigger **Web Push Notifications** (via Web-Push payload protocols) to the Service Worker.
* **Fallback:** Twilio SMS API for critical SOS and weather alerts if network degradation stops data connections.

### Offline-First Architecture Using IndexedDB

* **Synchronization Strategy:** Optimistic UI Updates. Writes (e.g., logging a new crop cycle, disease report offline) are intercepted by a Service Worker, stored in an IndexedDB `OutboxStore`, and executed with a unique UUID.
* **Sync Engine:** Upon network restoration (`window.addEventListener('online')`), the Outbox sequentially replays requests to the `/api/v1/sync` gateway. Conflicts use a **Last-Write-Wins (LWW)** resolution based on client-side generation timestamps.

### Weather Caching Strategy

* **Source:** OpenWeatherMap API / Open-Meteo.
* **Layer 1 Cache:** MongoDB Collection `weather_cache` indexed by GeoJSON `Coordinates` with a 30-minute Time-To-Live (TTL) index.
* **Layer 2 Cache:** Client-side IndexedDB stores the last fetched 7-day forecast data to ensure offline functionality for current field views.

### Disease Report Aggregation Strategy

* **Ingestion:** Image upload -> Gemini Vision assesses confidence and tags candidate pathogen -> Deterministic confirmation engine validates against local geography.
* **Aggregation pipeline:** A scheduled background worker groups validated detections by geographic coordinates (rounded to a $0.05^{\circ}$ grid resolution) every 3 hours. If the count exceeds a threshold density within a 10km radius, it auto-generates a regional outbreak entry in the `DiseaseRadar` collection and fires alerts.

### Field Stress Index (FSI) Architecture

* **Formula Engine:** Fully deterministic script operating on environmental and crop metrics.

$$FSI = (\omega_1 \times \text{TempStress}) + (\omega_2 \times \text{RainfallDeficit}) + (\omega_3 \times \text{GDDScale})$$


* **Execution:** Triggered on nightly weather updates or real-time manual pulls. Results dictate whether the system locks or unlocks mitigation advice in the RAG pipeline.

### Advisory & Explainability Engine Architecture

* **Deterministic Validation:** The Hybrid RAG pipeline fetches factual documentation via structured keyword matches and vector distance metrics from ChromaDB.
* **Context Packaging:** The engine formats a markdown text context packet containing:
1. The raw database values used.
2. The exact rule mathematical evaluation path.
3. The verified agronomic document excerpts.


* **Gemini Communication Layer:** Gemini is provided this complete packet with a strict system prompt: *"Translate and synthesize the provided deterministic context into empathetic, clear natural language. Do not invent any facts outside the context."*

---

## 25 Module Blueprint & Specifications

### 1. Authentication

* **Purpose:** Secure user access, identity verification, and role allocation.
* **Inputs:** Mobile Number / Email, Password, or OTP verification payload.
* **Outputs:** JWT Access Token, Refresh Token, User Metadata Profile.
* **Database Collections Used:** `Users`, `Sessions`.
* **APIs Involved:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`.
* **Dependencies:** None.
* **Offline Support Strategy:** Fallback validation using metadata signatures cached in IndexedDB. Allows restricted read-only dashboard interaction.
* **Integration Points with other modules:** Wraps all other modules via middleware injection dependency.

### 2. Farmer Onboarding

* **Purpose:** Captures basic farmer demographics, farm geography boundaries, and language preferences.
* **Inputs:** Profile Details, Farm Coordinates (GeoJSON Polygon), Land Size, Soil Type.
* **Outputs:** Onboarded Profile Status, Default Farm Boundary Identifier.
* **Database Collections Used:** `Users`, `Farms`.
* **APIs Involved:** `PUT /api/v1/users/profile`, `POST /api/v1/farms`.
* **Dependencies:** Authentication.
* **Offline Support Strategy:** Queue profile data in IndexedDB `OutboxStore`; submit when connection is established.
* **Integration Points with other modules:** Feeds location metadata directly to Weather Intelligence and Risk Heatmaps.

### 3. Weather Intelligence

* **Purpose:** Provides location-specific current, historical, and forecasted meteorological data.
* **Inputs:** Location Coordinates (Latitude/Longitude).
* **Outputs:** Temperature, Humidity, Precipitation, Wind Speed, Growing Degree Days (GDD).
* **Database Collections Used:** `WeatherCache`.
* **APIs Involved:** `GET /api/v1/weather/forecast`, `GET /api/v1/weather/historical`.
* **Dependencies:** Onboarding (Location).
* **Offline Support Strategy:** Caches the last retrieved 7-day forecast into IndexedDB `WeatherStore`.
* **Integration Points with other modules:** Feeds data directly into Crop Stage Engine, Field Stress Index, and Input Window Optimizer.

### 4. Crop Stage Engine

* **Purpose:** Calculates current physiological growth stage of the crop deterministically.
* **Inputs:** Crop Type, Sowing Date, Accumulated Growing Degree Days (GDD).
* **Outputs:** Current Growth Stage (e.g., Germination, Tillering, Flowering), Progress Percentage.
* **Database Collections Used:** `CropCycles`, `CropCharacteristics`.
* **APIs Involved:** `GET /api/v1/crop-cycles/{id}/stage`, `POST /api/v1/crop-cycles`.
* **Dependencies:** Onboarding, Weather Intelligence.
* **Offline Support Strategy:** Locally updates tracking estimations using time-elapsed models in IndexedDB.
* **Integration Points with other modules:** Feeds into Input Window Optimizer, What-If Simulator, and Daily Briefing.

### 5. Field Stress Index

* **Purpose:** Computes real-time environmental stress levels on crops using deterministic formulas.
* **Inputs:** Soil Moisture, Temperature Anomalies, Stage Vulnerability Factors.
* **Outputs:** Numerical Stress Index (0.0 to 1.0), Primary Stress Category.
* **Database Collections Used:** `CropCycles`, `StressLogs`.
* **APIs Involved:** `GET /api/v1/stress-index/{farm_id}`.
* **Dependencies:** Crop Stage Engine, Weather Intelligence.
* **Offline Support Strategy:** Local UI computes fallback stress metrics via cached 3-day weather trends.
* **Integration Points with other modules:** Triggers Alert Engine and limits responses within AI Advisory Assistant.

### 6. AI Advisory Assistant

* **Purpose:** Interfaces with the farmer via clear, natural language synthesis based on deterministic facts.
* **Inputs:** User Query Text/Voice, Local Farm Context Packet.
* **Outputs:** Factual, natural language advisory message.
* **Database Collections Used:** `AdvisoryLogs`.
* **APIs Involved:** `POST /api/v1/advisory/ask`.
* **Dependencies:** Knowledge Base + Hybrid RAG, Explainability Engine.
* **Offline Support Strategy:** Blocks new requests; queues queries or prompts user to wait for network availability.
* **Integration Points with other modules:** Integrates Voice Advisory and Explainability Engine workflows.

### 7. Knowledge Base + Hybrid RAG

* **Purpose:** Retrieves agronomic, regulatory, and mitigation guidelines using strict text matching and vector lookups.
* **Inputs:** Search terms, vector embeddings of the user's localized query.
* **Outputs:** Validated reference document text blocks and verified citations.
* **Database Collections Used:** ChromaDB (`agri_kb` collection), MongoDB `KnowledgeMetadata`.
* **APIs Involved:** Internal query dispatch interfaces.
* **Dependencies:** None.
* **Offline Support Strategy:** Syncs a top-tier checklist database of frequent local agronomic issues directly to IndexedDB.
* **Integration Points with other modules:** Acts as the deterministic data filter for the AI Advisory Assistant.

### 8. Crop Disease Detection

* **Purpose:** Processes plant images to evaluate possible structural or pathogen damage.
* **Inputs:** Image File Binary.
* **Outputs:** Diagnosed Disease Label, Confidence Score, Visual Vector Coordinates.
* **Database Collections Used:** `DiseaseReports`.
* **APIs Involved:** `POST /api/v1/disease/detect`.
* **Dependencies:** Gemini Vision API integration layer.
* **Offline Support Strategy:** Stores captured image raw base64 arrays inside IndexedDB for delayed execution on reconnection.
* **Integration Points with other modules:** Supplies data to Community Disease Radar and Farmer Health Card.

### 9. Community Disease Radar

* **Purpose:** Identifies local regional disease outbreaks using geolocation data clusters.
* **Inputs:** Geolocation, Confirmed Disease IDs, Timeframes.
* **Outputs:** List of active high-risk pathogens within a defined local radius.
* **Database Collections Used:** `DiseaseRadar`, `DiseaseReports`.
* **APIs Involved:** `GET /api/v1/disease-radar/nearby`.
* **Dependencies:** Crop Disease Detection.
* **Offline Support Strategy:** Caches local hotspot vectors to show static localized map points when offline.
* **Integration Points with other modules:** Automatically creates inputs for the Risk Heatmap and Alert Engine.

### 10. Scheme Eligibility Checker

* **Purpose:** Evaluates farmer profile eligibility against government or environmental benefit programs.
* **Inputs:** Farmer Demographics, Land Area, Location, Income Indicators.
* **Outputs:** List of Approved/Eligible Schemes, Required Application Steps.
* **Database Collections Used:** `Schemes`.
* **APIs Involved:** `GET /api/v1/schemes/eligible`.
* **Dependencies:** Onboarding.
* **Offline Support Strategy:** Full evaluation logic is implemented via backend-equivalent JavaScript functions running on cached schema JSON sheets inside IndexedDB.
* **Integration Points with other modules:** Logs notifications via the Alert Engine when eligibility parameters change.

### 11. Soil Health Assessment

* **Purpose:** Stores, tracks, and evaluates soil nutrient parameters against standard soil targets.
* **Inputs:** N-P-K levels, pH value, Organic Carbon content, Electrical Conductivity.
* **Outputs:** Deficiency Status Matrix, Soil Health Index Rating.
* **Database Collections Used:** `SoilRecords`.
* **APIs Involved:** `POST /api/v1/soil/records`, `GET /api/v1/soil/records/latest`.
* **Dependencies:** Onboarding.
* **Offline Support Strategy:** Allows entry and verification of historical soil data charts stored locally in IndexedDB.
* **Integration Points with other modules:** Supplies crucial baseline constants to the What-If Simulator and Input Window Optimizer.

### 12. Market Intelligence

* **Purpose:** Tracks and forecasts commodities market trading prices across local agricultural trading hubs.
* **Inputs:** Market Name (Mandi), Crop Type.
* **Outputs:** Minimum, Maximum, and Modal Price records, Daily Price Trends.
* **Database Collections Used:** `MarketPrices`.
* **APIs Involved:** `GET /api/v1/market/prices`.
* **Dependencies:** Onboarding (Location/Crops).
* **Offline Support Strategy:** Displays last known market rates cached during the user's previous active session.
* **Integration Points with other modules:** Provides inputs for the Daily 6AM Briefing.

### 13. Alert Engine

* **Purpose:** Monitors thresholds and dispatches actionable alert messages to affected users.
* **Inputs:** Sensor Metrics, Weather Forecast Data, Disease Outbreak Conditions.
* **Outputs:** Evaluated System Alerts.
* **Database Collections Used:** `Alerts`.
* **APIs Involved:** `POST /api/v1/alerts/trigger-evaluation`.
* **Dependencies:** Weather Intelligence, Community Disease Radar.
* **Offline Support Strategy:** Evaluates alerts locally on the device using active IndexedDB weather trends.
* **Integration Points with other modules:** Dispatches events directly to the Notification Center.

### 14. Notification Center

* **Purpose:** Manages delivery states, channels, and reading history for user alerts.
* **Inputs:** Alert Object, User Routing Preference.
* **Outputs:** Delivery execution via Web Push, SSE, or SMS.
* **Database Collections Used:** `Notifications`.
* **APIs Involved:** `GET /api/v1/notifications`, `PUT /api/v1/notifications/{id}/read`.
* **Dependencies:** Authentication.
* **Offline Support Strategy:** Marks notifications as read locally in IndexedDB; syncs state changes on reconnect.
* **Integration Points with other modules:** Functions as the primary notification hub for the platform.

### 15. Farmer Health Card

* **Purpose:** Summarizes the entire health profile of the farm assets into a single comprehensive dashboard view.
* **Inputs:** Crop Stage, Stress Metric, Soil Status, Regional Disease Status.
* **Outputs:** Aggregated Health Status Document, Risk Rating score.
* **Database Collections Used:** Generated dynamically from primary data states.
* **APIs Involved:** `GET /api/v1/health-card`.
* **Dependencies:** Crop Stage Engine, Field Stress Index, Soil Health Assessment.
* **Offline Support Strategy:** Synthesizes local values within IndexedDB to render an instant offline overview.
* **Integration Points with other modules:** Served as the high-level landing visualization on the mobile app home screen.

### 16. Offline First PWA

* **Purpose:** Orchestrates network requests, runs the service worker lifecycle, and manages background data syncing.
* **Inputs:** Network state change indicators, interceptable Fetch requests.
* **Outputs:** Seamless local application access across varying network environments.
* **Database Collections Used:** None directly (manages client IndexedDB stores).
* **APIs Involved:** `/api/v1/sync`.
* **Dependencies:** Frontend core framework build blocks.
* **Offline Support Strategy:** Actively provides fallback resources for all assets and requests via Service Worker routing intercepts.
* **Integration Points with other modules:** Acts as the delivery layer for all frontend platform features.

### 17. Input Window Optimizer

* **Purpose:** Evaluates whether current and forecasted weather patterns are optimal for applying inputs like fertilizer, irrigation, or pesticides.
* **Inputs:** Crop Stage, Wind Speed, Rainfall Forecast, Planned Action Type.
* **Outputs:** Binary Safety Flag (Safe/Unsafe), Optimization Reason.
* **Database Collections Used:** `CropCharacteristics`.
* **APIs Involved:** `POST /api/v1/optimizer/window`.
* **Dependencies:** Weather Intelligence, Crop Stage Engine.
* **Offline Support Strategy:** Evaluates constraints locally using rules against the 3-day forecast in IndexedDB.
* **Integration Points with other modules:** Feeds recommendations into the Daily 6AM Briefing and Alerts.

### 18. Voice Advisory

* **Purpose:** Allows hands-free operation by processing spoken voice input queries and reading back system outputs.
* **Inputs:** Audio Stream/Blob.
* **Outputs:** Transcribed Text, Synthesis Audio Output.
* **Database Collections Used:** `AdvisoryLogs`.
* **APIs Involved:** `POST /api/v1/voice/transcribe`, `POST /api/v1/voice/synthesize`.
* **Dependencies:** AI Advisory Assistant.
* **Offline Support Strategy:** Blocks new requests; notifies user that voice interaction requires a network connection.
* **Integration Points with other modules:** Serves as a frontend accessibility wrapper for the AI Advisory Assistant.

### 19. What-If Simulator (Crop Twin)

* **Purpose:** Simulates crop yields and stress outcomes under varying hypothetical weather or management scenarios.
* **Inputs:** Hypothetical Irrigation Frequency, Target Temperature Shift, Fertilizer Level modifications.
* **Outputs:** Simulated Stress Curves, Projected Harvest Yield Adjustments.
* **Database Collections Used:** `CropCharacteristics`.
* **APIs Involved:** `POST /api/v1/simulator/run`.
* **Dependencies:** Crop Stage Engine, Soil Health Assessment.
* **Offline Support Strategy:** Runs lightweight mathematical equations directly within client-side Web Workers using IndexedDB lookups.
* **Integration Points with other modules:** Connects directly with the Explainability Engine to illustrate outcomes.

### 20. Explainability Engine

* **Purpose:** Formulates explicit, human-readable rationales showing exactly why a rule triggered or why an advice was selected.
* **Inputs:** Executed Rule Node Paths, Logical Condition Metrics.
* **Outputs:** Structured Truth Rationale Matrix (e.g., "Condition triggered because Temp=41°C > Limit=40°C").
* **Database Collections Used:** `SystemRules`.
* **APIs Involved:** Internal validation utility functions.
* **Dependencies:** None.
* **Offline Support Strategy:** Regenerates raw rule justifications client-side using JavaScript logic matches.
* **Integration Points with other modules:** Validates outputs for the AI Advisory Assistant and What-If Simulator.

### 21. Daily 6AM Briefing

* **Purpose:** Generates a structured, concise daily operational summary for the farmer's morning routine.
* **Inputs:** Current Weather Forecast, Pending Input Windows, High-Risk Alerts, Market Price updates.
* **Outputs:** Structured text summary packet.
* **Database Collections Used:** `BriefingLogs`.
* **APIs Involved:** `GET /api/v1/briefing/daily`.
* **Dependencies:** Weather Intelligence, Input Window Optimizer, Market Intelligence.
* **Offline Support Strategy:** Synthesizes local data states within IndexedDB to output a fallback overview.
* **Integration Points with other modules:** Delivers compiled data to the AI Advisory Assistant for multi-lingual synthesis.

### 22. SOS Emergency Module

* **Purpose:** Provides a one-click response interface during extreme conditions (e.g., severe flash flooding, sudden frost).
* **Inputs:** SOS Button Event, Instant GPS coordinates.
* **Outputs:** Immediate mitigation checklists and automated SMS broadcast triggers.
* **Database Collections Used:** `SOSActions`.
* **APIs Involved:** `POST /api/v1/sos/trigger`.
* **Dependencies:** Authentication.
* **Offline Support Strategy:** Forces immediate delivery via backup SMS protocol stacks if data networks fail.
* **Integration Points with other modules:** Overrides the UI to broadcast priority instructions to the Notification Center.

### 23. Risk Heatmap

* **Purpose:** Generates spatial risk visuals for regional administrative oversight dashboards.
* **Inputs:** Coordinate bounding boxes, aggregate disease vectors, weather stress logs.
* **Outputs:** GeoJSON feature collections containing regional risk weight values.
* **Database Collections Used:** `Farms`, `DiseaseRadar`, `StressLogs`.
* **APIs Involved:** `GET /api/v1/analytics/risk-heatmap`.
* **Dependencies:** Community Disease Radar, Field Stress Index.
* **Offline Support Strategy:** Displays last retrieved heatmap layer array cache.
* **Integration Points with other modules:** Aggregates background telemetry from all operational farm clusters.

### 24. Multilingual System

* **Purpose:** Translates system text, alerts, and field labels into the farmer's native dialect.
* **Inputs:** Raw String Data, Target Language ISO Code.
* **Outputs:** Localized Target String.
* **Database Collections Used:** `LocalizationDictionary`.
* **APIs Involved:** Internal translation utility handlers (powered by Gemini translation calls).
* **Dependencies:** None.
* **Offline Support Strategy:** Loads core localized language packs directly from IndexedDB string tables.
* **Integration Points with other modules:** Applied as a formatting layer to all customer-facing text outputs.

### 25. Demo Mode

* **Purpose:** Provides fully populated, fictional mock environments for instant app demonstrations without live sensors.
* **Inputs:** Active Toggle Flag.
* **Outputs:** Randomized, realistic state transitions for farms, anomalies, and weather tracking.
* **Database Collections Used:** None (Uses client-side static arrays).
* **APIs Involved:** `/api/v1/demo/initialize`.
* **Dependencies:** None.
* **Offline Support Strategy:** Operates completely offline within the client PWA sandbox environment.
* **Integration Points with other modules:** Overrides API client routing hooks to decouple from remote servers completely.

---

## Technical Data Structures & Schemas

### MongoDB Schema Definitions

#### Users Collection

```json
{
  "_id": "ObjectId",
  "name": "String",
  "email": "String (Unique, Optional)",
  "phone": "String (Unique)",
  "password_hash": "String",
  "role": "String (FARMER|AGRONOMIST|ADMIN)",
  "preferred_lang": "String (Default: hi)",
  "created_at": "ISODate"
}

```

#### Farms Collection

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId (Index)",
  "name": "String",
  "boundary": {
    "type": "String (Polygon)",
    "coordinates": "Array"
  },
  "soil_type": "String",
  "created_at": "ISODate"
}

```

*Index Strategy:* `db.farms.createIndex({ "boundary": "2dsphere" })`

#### CropCycles Collection

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (Index)",
  "crop_type": "String",
  "sowing_date": "ISODate",
  "current_gdd": "Double",
  "status": "String (ACTIVE|HARVESTED)",
  "updated_at": "ISODate"
}

```

#### DiseaseReports Collection

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "farm_id": "ObjectId",
  "image_url": "String",
  "detected_disease": "String",
  "confidence": "Double",
  "location": {
    "type": "String (Point)",
    "coordinates": "Array"
  },
  "created_at": "ISODate"
}

```

*Index Strategy:* `db.disease_reports.createIndex({ "location": "2dsphere" })`

#### DiseaseRadar Collection

```json
{
  "_id": "ObjectId",
  "disease_name": "String",
  "location_grid": {
    "type": "String (Point)",
    "coordinates": "Array"
  },
  "case_count": "Int32",
  "risk_level": "String (LOW|MEDIUM|HIGH)",
  "last_updated": "ISODate"
}

```

### ChromaDB Architecture (Hybrid RAG)

#### Collection: `agri_knowledge`

* **Embedding Model:** `text-embedding-3-small` (1536 Dimensions)
* **Metadata Schema Matrix:**

```json
{
  "source_document": "String",
  "crop_type": "String (Indexable keyword)",
  "disease_tag": "String (Indexable keyword)",
  "topic": "String (irrigation|fertilizer|pest_control)",
  "allowed_regions": "String"
}

```

---

## Detailed Data Flow Map

This breakdown shows exactly how data moves across boundaries for a typical complex operational lifecycle:

```
[Weather/Radar Telemetry] ──> [Deterministic FSI Engine] ──> Write to MongoDB
                                                                 │
                                                                 ▼
[User Ask Query Context]  ──> [Fetch Hybrid RAG ChromaDB] ──> [Compile Context Packet]
                                                                 │
                                                                 ▼
[User Output Delivered]   <── [Gemini Translation Layer]  <── [Inject Explainability]

```

---

## Production API Endpoint Matrix

| Method | Endpoint | Auth | Request Body (Payload) | Response Structure (200 OK) |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | None | `{"phone": "X", "password": "Y"}` | `{"status": "created", "user_id": "ID"}` |
| `POST` | `/api/v1/auth/login` | None | `{"phone": "X", "password": "Y"}` | `{"access_token": "JWT", "type": "Bearer"}` |
| `POST` | `/api/v1/farms` | `FARMER` | `{"name": "X", "boundary": {...}}` | `{"id": "ObjectId", "status": "saved"}` |
| `GET` | `/api/v1/weather/forecast` | `FARMER` | None (Query Parameters: `farm_id`) | `{"temp": 32, "forecast": [...]}` |
| `GET` | `/api/v1/crop-cycles/stage` | `FARMER` | None (Query Parameters: `cycle_id`) | `{"stage": "Flowering", "gdd": 420.5}` |
| `POST` | `/api/v1/disease/detect` | `FARMER` | `FormData` (Image Binary Multipart) | `{"disease": "Rust", "confidence": 0.94}` |
| `POST` | `/api/v1/advisory/ask` | `FARMER` | `{"query": "String", "farm_id": "ID"}` | `{"response": "Text String", "rules": []}` |

---

## Complete Monolithic Codebase Structural Blueprint

### Frontend Layout Tree (Next.js PWA)

```
/harvestiq-client
├── public/
│   ├── workers/
│   │   └── sync-worker.js
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── ui/ (ShadCN UI Elements)
│   │   ├── WeatherCard.tsx
│   │   ├── HealthCard.tsx
│   │   └── RadarMap.tsx
│   ├── hooks/
│   │   ├── useIndexedDB.ts
│   │   └── useOnlineStatus.ts
│   ├── lib/
│   │   └── db.ts (IndexedDB Initialization configuration)
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx (Dashboard View)
│       ├── advisory/
│       │   └── page.tsx
│       └── disease/
│           └── page.tsx

```

### Backend Layout Tree (FastAPI Project)

```
/harvestiq-engine
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py (MongoDB + Chroma Setup)
│   ├── models/
│   │   ├── user.py
│   │   └── farm.py
│   ├── services/
│   │   ├── deterministic_engine.py (FSI / GDD logic)
│   │   ├── rag_service.py
│   │   └── gemini_client.py
│   └── api/
│       └── v1/
│           ├── auth.py
│           ├── advisory.py
│           └── disease.py
├── tests/
└── requirements.txt

```

---

## Concrete Implementation Order (Dependency Graph)

The platform must be implemented in a strict linear order to ensure dependencies exist before down-stream features are compiled:

```
[1. Baseline Stack] ──> [2. Farm Data Core] ──> [3. Environmental Engines]
                                                         │
                                                         ▼
[5. Platform Core]  <── [4. RAG Foundations] <── [3. Environmental Engines]
        │
        ▼
[6. Advanced Systems] ──> [7. Final Polish & Production Demo]

```

```
   Authentication (Day 1)
          │
          ▼
   Farmer Onboarding (Day 1)
          │
          ▼
   Weather Intelligence (Day 2)
          │
          ▼
   Crop Stage Engine (Day 2)
          │
          ▼
   Field Stress Index (Day 3)
          │
          ├───────────────────────────────┐
          ▼                               ▼
   Knowledge Base + Hybrid RAG (Day 4)   Crop Disease Detection (Day 4)
          │                               │
          ▼                               ▼
   AI Advisory Assistant (Day 5)         Community Disease Radar (Day 5)
          │                               │
          ├───────────────────────────────┘
          ▼
   Remaining Modules & PWA Polish (Day 6 & 7)

```

---

## 7-Day Agile Tactical Execution Plan

### Day 1: System Baseline & Identity Layout

* **Focus:** Core plumbing, Database integration, Identity constraints.
* **Backend:** Set up FastAPI boilerplate, configure MongoDB Atlas database connectors, write JWT Bearer validation middleware layer.
* **Frontend:** Initialize Next.js client environment with Tailwind CSS and ShadCN boilerplate configurations. Setup `manifest.json` asset schemas.
* **Modules Completed:** 1. Authentication, 2. Farmer Onboarding.

### Day 2: Environmental Calculations & Tracking

* **Focus:** Time and climate tracking engines.
* **Backend:** Implement external cron connectors to weather networks. Code the deterministic $GDD$ processing logic block based on standard base targets.
* **Frontend:** Create dashboard layout screens, loading tracking view skeletons, and basic geofenced coordinate capture UI items.
* **Modules Completed:** 3. Weather Intelligence, 4. Crop Stage Engine.

### Day 3: Field Stress Index & Cache Stacks

* **Focus:** Math model ingestion, Local infrastructure.
* **Backend:** Write the Field Stress Index calculation scripts ($FSI$). Implement the automated 30-minute location-based caching protocols.
* **Frontend:** Configure IndexedDB stores using `idb` wrappers. Wire the application layout context to pull from the client-side IndexedDB whenever server requests fail.
* **Modules Completed:** 5. Field Stress Index, 13. Alert Engine, 20. Explainability Engine.

### Day 4: Data Processing & Visual Tracking Layers

* **Focus:** Document chunk embedding parsing and multi-modal asset evaluation.
* **Backend:** Load agronomic text sheets, slice chunks into target pieces, index inside ChromaDB collection vectors. Link FastAPI to Gemini Vision upload pipes.
* **Frontend:** Create basic camera-capture inputs, photo review panels, and map container views.
* **Modules Completed:** 7. Knowledge Base + Hybrid RAG, 8. Crop Disease Detection, 11. Soil Health Assessment.

### Day 5: Advisory Engine & Intelligence Assembly

* **Focus:** Combining deterministic fact inputs with linguistic models.
* **Backend:** Implement the RAG pipeline to generate the Context Package, validate it with the Explainability Engine, and forward the result to Gemini for final natural language synthesis.
* **Frontend:** Build responsive multi-lingual conversation interfaces and floating speech toggle capture components.
* **Modules Completed:** 6. AI Advisory Assistant, 9. Community Disease Radar, 18. Voice Advisory, 24. Multilingual System.

### Day 6: Automation, Operations & Dashboards

* **Focus:** Feature updates, overview tools, batch processing.
* **Backend:** Build price aggregation workers, rule parsing loops, eligibility lookup logic tables, and regional matrix calculation scripts.
* **Frontend:** Assemble the unified Farmer Health Card dashboard grid and configure interactive simulation forms.
* **Modules Completed:** 10. Scheme Eligibility Checker, 12. Market Intelligence, 14. Notification Center, 15. Farmer Health Card, 17. Input Window Optimizer, 19. What-If Simulator, 21. Daily 6AM Briefing.

### Day 7: Network Edge Resiliency, Security Hardening & Handover

* **Focus:** Production readiness, testing, deployment.
* **Backend:** Apply CORS rules, set up security profiles, and deploy the FastAPI backend on Render. Set up rate limiters.
* **Frontend:** Deploy the Next.js frontend to Vercel. Activate the service worker lifecycle for comprehensive production testing.
* **Modules Completed:** 16. Offline First PWA, 22. SOS Emergency Module, 23. Risk Heatmap, 25. Demo Mode.

---

## Production Hardening Guidelines

### Security Best Practices

* **Payload Sanitation:** Validate input fields via explicit Pydantic schemas in FastAPI to block cross-site scripting (XSS) injection attempts.
* **Token Strategy:** Use short expiration windows (15 minutes) for JWT access structures. Store verification state objects only inside encrypted memory layers.
* **Network Communications:** Require TLS 1.3 across transport chains. Enforce custom Content Security Policies (CSP) header values to block untrusted external script delivery.

### Rate Limiting Strategy

* **Public Interfaces:** Restrict anonymous login and registration endpoints to a maximum of 5 attempts per IP address every 15 minutes using slowapi middleware.
* **Authenticated Operations:** Limit resource-heavy advisory routes (`/api/v1/advisory/ask`) to a maximum of 60 requests per hour per user profile identifier to prevent API overload.

### Deployment Architecture

* **Frontend Platform:** Next.js deployment hosted directly on **Vercel Edge Network**, utilizing global asset caching policies.
* **Application Services:** FastAPI instance running as a Dockerized container on **Render (Web Services)** behind an automated proxy layer.
* **Persistent Infrastructure:** Managed **MongoDB Atlas (M10 tier)** instances combined with external cloud hosted instances running **ChromaDB**.

---

## Summary of Request and Suggestions

You requested a production-grade, 7-day hackathon-ready architecture blueprint for **HarvestIQ**, an agricultural intelligence platform containing 25 specialized modules. You specified that **HarvestIQ must act as the primary, deterministic decision-making layer**, limiting Gemini strictly to linguistic translation, image synthesis, and accessibility functions.

In response, I have provided:

* A comprehensive architecture framework showing clear separation between the deterministic engine and the LLM layer.
* A concrete 7-day tactical sprint timeline prioritizing development prerequisites.
* Detailed architectural specifications for every required module, complete with input/output matrices, schemas, and offline failover patterns.
