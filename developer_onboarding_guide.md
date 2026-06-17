# HarvestIQ Developer Handoff & Fresh Machine Setup Guide

This guide is designed for developers setting up the HarvestIQ project from scratch on a new machine, specifically optimized for Apple Silicon (MacBook Air M2). Follow these instructions to clone, configure, seed, and run HarvestIQ successfully.

---

## Section 1 — Prerequisites

Install these system tools and dependencies on your fresh Mac M2:

### 1. Homebrew (Package Manager)
Install Homebrew if you don't already have it:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Add Homebrew to your shell configuration (`~/.zprofile`):
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 2. Git
```bash
brew install git
```

### 3. Node.js & npm (Frontend Client)
Next.js requires Node.js v20+. We recommend using **nvm** (Node Version Manager) to manage Node versions easily:
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart your terminal, then install Node.js 20
nvm install 20
nvm use 20
```
Verify installations:
```bash
node -v  # Expected: v20.x.x
npm -v   # Expected: v10.x.x
```

### 4. Python & pip (Backend Engine)
HarvestIQ Engine requires Python 3.12+. We recommend **Python 3.12** for stability on macOS:
```bash
brew install python@3.12
```
Verify installation:
```bash
python3.12 --version  # Expected: Python 3.12.x
```

### 5. MongoDB Tools (Optional GUI)
To visualize and debug your database, install MongoDB Compass:
```bash
brew install --cask mongodb-compass
```

### 6. Docker (Optional)
If you want to run the backend in a containerized environment:
```bash
brew install --cask docker
```

### 7. Recommended VS Code Extensions
If using Visual Studio Code, install these extensions:
* **Python** (`ms-python.python`)
* **Pylance** (`ms-python.vscode-pylance`)
* **Prettier** (`esbenp.prettier-vscode`)
* **ESLint** (`dbaeumer.vscode-eslint`)

---

## Section 2 — Repository Setup

### Option A — Git Clone Workflow
Clone the repository from your Git host and enter the directory:
```bash
git clone <repository-url>
cd HARVESTIQ
```

### Option B — Direct Folder Share (Zip Archive)
If sharing the `HARVESTIQ` project directory directly via a zip archive:

#### What Works
* All source code (`harvestiq-engine/app`, `harvestiq-client/src`).
* Seeding scripts and JSON files (`harvestiq-engine/data/`, `harvestiq-engine/scripts/`).
* Configuration templates (`.env.example`, `.env.local.example`).
* Markdown documentation and build settings (`package.json`, `requirements.txt`).

#### What to Exclude (Do NOT Copy/Zip)
Ensure you remove the following folders before zipping, or delete them immediately upon unzipping:
* **`harvestiq-client/node_modules/`**: Large, platform-dependent frontend dependency binaries.
* **`harvestiq-engine/.venv/`**: Python virtual environment contains binaries compiled specifically for the original developer's OS/architecture; it will crash on a fresh M2.
* **`harvestiq-client/.next/`**: The compiled Next.js build cache.
* **`harvestiq-engine/.pytest_cache/` & `harvestiq-engine/app/**/__pycache__/`**: Python testing and compilation caches.
* **`harvestiq-client/tsconfig.tsbuildinfo`**: TypeScript build cache.
* **`.env` and `.env.local`**: Personal files containing developer secrets and credentials.

#### How to clean and zip the project for handoff:
```bash
# Run from the root of the HARVESTIQ directory
rm -rf harvestiq-client/node_modules
rm -rf harvestiq-client/.next
rm -rf harvestiq-client/tsconfig.tsbuildinfo
rm -rf harvestiq-engine/.venv
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type d -name ".pytest_cache" -exec rm -rf {} +
rm -f harvestiq-engine/.env harvestiq-client/.env.local
```

---

## Section 3 — Environment Variables Audit

Copy the template configuration files to initialize environment variables.

### Backend Configurations (`harvestiq-engine/.env`)
Create the environment file:
```bash
cd harvestiq-engine
cp .env.example .env
```

Open `.env` and configure the following variables:

| Variable | Required? | Default / Example | Purpose / Usage | Substitution/Replacement Values |
| :--- | :---: | :--- | :--- | :--- |
| **`MONGODB_URI`** | **Yes** | `mongodb+srv://...` | Connection URI for the MongoDB Atlas cluster or local database. | Can use local `mongodb://localhost:27017` if running MongoDB locally. |
| **`MONGODB_DB_NAME`** | No | `harvestiq` | Database name inside the cluster. | Customize to isolate developer sandboxes (e.g. `harvestiq_dev_name`). |
| **`JWT_SECRET_KEY`** | **Yes** | `change-me-to-a-long...` | Used to sign session Access and Refresh tokens. | Enter a secure random string (minimum 32 characters). |
| **`JWT_ALGORITHM`** | No | `HS256` | JWT cryptographic algorithm. | Keep `HS256`. |
| **`ACCESS_TOKEN_EXPIRE_MINUTES`** | No | `15` | Active token expiration. | Can raise to `60` or `120` to reduce refresh calls during testing. |
| **`REFRESH_TOKEN_EXPIRE_DAYS`** | No | `7` | Refresh cookie expiration. | Default is fine. |
| **`CORS_ORIGINS`** | No | `http://localhost:3000` | Whitelisted origins for API calls. | Must match client URL (default is client dev server). |
| **`COOKIE_SECURE`** | No | `false` | Enables cookie transit only over HTTPS. | Must be `false` for local HTTP development. |
| **`COOKIE_SAMESITE`** | No | `lax` | Browser cookie cross-site policy. | Default `lax` is recommended. |
| **`ENVIRONMENT`** | No | `development` | Changes API error stack-traces visibility. | Keep `development`. |
| **`OPEN_METEO_BASE_URL`** | No | `https://api.open-meteo.com/v1/forecast` | Base API route for weather queries. | Keep default. |
| **`OPENWEATHER_API_KEY`** | No | (empty) | Key for OpenWeather queries (inactive in code). | Safe to leave empty. |
| **`WEATHER_CACHE_TTL_MINUTES`** | No | `30` | Minutes to cache weather forecast results. | Increase or decrease based on api rate-limit needs. |
| **`CHROMA_PERSIST_DIR`** | No | `data/chroma` | Path to save persistent SQLite-backed vector store. | Keep default. |
| **`GEMINI_API_KEY`** | **Yes** | (empty) | API key to communicate with Google Gemini models. | Get a free key from Google AI Studio. Critical for Advisory, Voice, and Vision features. |
| **`GEMINI_VISION_MODEL`** | No | `gemini-2.0-flash` | LLM model for crop disease detection. | Default `gemini-2.0-flash` is recommended. |
| **`GEMINI_TEXT_MODEL`** | No | `gemini-2.0-flash` | LLM model for Advisory text/Audio transcriptions. | Default `gemini-2.0-flash` is recommended. |
| **`DISEASE_CONFIDENCE_THRESHOLD`** | No | `0.70` | Threshold below which image detections are rejected. | Can lower (e.g. `0.50`) for looser testing checks. |
| **`DISEASE_UPLOAD_DIR`** | No | `data/uploads/disease` | Directory where uploaded image files are cached. | Keep default. |
| **`TWILIO_ACCOUNT_SID`** | No | (empty) | Twilio account identifier. | Optional. If left blank, SMS services gracefully log mock messages. |
| **`TWILIO_AUTH_TOKEN`** | No | (empty) | Twilio API authentication token. | Optional. |
| **`TWILIO_FROM_NUMBER`** | No | (empty) | Twilio phone number. | Optional. |

### Frontend Configurations (`harvestiq-client/.env.local`)
Create the environment file:
```bash
cd harvestiq-client
cp .env.local.example .env.local
```

| Variable | Required? | Default / Example | Purpose / Usage | Substitution/Replacement Values |
| :--- | :---: | :--- | :--- | :--- |
| **`BACKEND_URL`** | **Yes** | `http://localhost:8000` | Tells Next.js where to proxy client API routes (`/api/*`). | Must match backend local engine url. |

---

## Section 4 — MongoDB Audit

### Recommended Approach: Option B — Developer Creates Their Own Free Atlas Cluster
To avoid security concerns, IP whitelisting headaches (since residential developer IPs change frequently), and data interference, developers should create their own free Atlas instances.

1. **Create Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free cloud account.
2. **Deploy Cluster**: Create a new project, select the **M0 Shared (Free)** tier, pick your cloud provider (AWS/GCP/Azure), and select a nearby region. Click **Create**.
3. **Add Database User**:
   * Navigate to **Database Access** (under Security).
   * Click **Add New Database User**.
   * Choose Password authentication, set username (e.g., `harvestiq-dev-user`) and a secure password.
   * Under Database User Privileges, select **Read and write to any database**.
   * Click **Add User**.
4. **Configure Firewall**:
   * Navigate to **Network Access** (under Security).
   * Click **Add IP Address**.
   * Click **Allow Access from Anywhere** (`0.0.0.0/0`) for development, or **Add Current IP Address**.
   * Click **Confirm**.
5. **Get Connection String**:
   * Go to **Database** (under Deployment) and click **Connect**.
   * Select **Drivers**, choose **Python** (version **3.11 or later**).
   * Copy the connection string (e.g., `mongodb+srv://<username>:<password>@clusterX.xxxx.mongodb.net/?retryWrites=true&w=majority`).
6. **Update `.env`**:
   * Open `harvestiq-engine/.env` and paste it under `MONGODB_URI`.
   * Replace `<password>` with the password you generated, ensuring any special characters are URL-encoded (`@` -> `%40`, `#` -> `%23`, etc.).
   * Set `MONGODB_DB_NAME=harvestiq`.

### Alternative Approach: Option A — Share Existing Cluster
If sharing the owner's existing cluster:
1. **Connection String**: The owner must share their connection string (e.g., `mongodb+srv://jaiswalvishal9694_db_user:<password>@cluster0.muzpcg4.mongodb.net/?appName=Cluster0`).
2. **Network Access**: The owner must log into MongoDB Atlas, navigate to **Network Access**, and add the new developer's public IP address. Alternatively, the owner can whitelist `0.0.0.0/0` (not recommended for production environments).
3. **Data Isolation (Important)**: To prevent developers from modifying each other's test data (e.g. deleting users or farms), the new developer should use a distinct database name in their local `harvestiq-engine/.env`:
   ```env
   MONGODB_DB_NAME=harvestiq_dev_friendname
   ```
   This isolates the collections in a separate database instance inside the shared cluster.

---

## Section 5 — External Services Audit

Here are the external services used by the HarvestIQ codebase:

| Service | Required? | Setup Needed? | Credentials / Access Details |
| :--- | :---: | :---: | :--- |
| **MongoDB Atlas** | **Yes** | Yes | PyMongo driver string (`MONGODB_URI`). Essential for account authentication, onboarding data, and operational states. |
| **Google Gemini API** | **Yes** (For AI features) | Yes | Google AI Studio API key (`GEMINI_API_KEY`). Powers daily operational briefings, agronomic question RAG answers, and voice-transcription. |
| **Open-Meteo API** | **Yes** | No | Injected via default base URL. No keys or registration required. Supplies weather telemetry and GDD data. |
| **ChromaDB** | **Yes** | No | Embedded SQLite vector database. Installs as a Python package. Runs locally; databases are saved to `data/chroma`. No API keys needed. |
| **Twilio** | **No** (Optional) | Optional | Accounts keys (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Used for emergency SOS SMS messages. Falls back to console logs if absent. |
| **OpenWeather** | **No** | No | Deprecated or unused config key. Not utilized in current client services (Open-Meteo supplies forecasts). Can remain blank. |

---

## Section 6 — Backend Startup

Open a terminal and run the following commands to initialize and start the FastAPI engine:

```bash
# 1. Enter engine directory
cd harvestiq-engine

# 2. Re-create python virtual environment (forcing Python 3.12)
rm -rf .venv
python3.12 -m venv .venv

# 3. Activate virtual environment
source .venv/bin/activate

# 4. Upgrade pip and install package dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 5. Seed Database Collections (Mandatory)
python scripts/seed_crop_characteristics.py
python scripts/seed_knowledge_base.py
python scripts/seed_localization.py
python scripts/seed_market_prices.py
python scripts/seed_schemes.py
python scripts/seed_system_rules.py

# 6. Start the FastAPI backend
./scripts/start.sh
```

### Expected Success Output (Start Server)
```text
Starting HarvestIQ backend on http://127.0.0.1:8000
API docs: http://127.0.0.1:8000/docs

INFO:     Will watch for changes in these paths: ['/Users/.../HARVESTIQ/harvestiq-engine']
INFO:     Uvicorn server running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Verify Endpoint Status
Open another terminal and verify backend connectivity:
```bash
curl http://localhost:8000/health
```
**Expected Response:**
```json
{"status":"ok","environment":"development","db":"ok"}
```

---

## Section 7 — Frontend Startup

Open a separate terminal window and execute these commands to run the Next.js app:

```bash
# 1. Enter client directory
cd harvestiq-client

# 2. Install node dependencies
npm install

# 3. Compile the build pipeline (types and asset verification)
npm run build

# 4. Start Next.js Development Server
npm run dev
```

### Expected Success Output (Dev Server)
```text
▲ Next.js 16.2.9
  - Local:        http://localhost:3000

✓ Starting...
✓ Ready in 1.2s
```

Open your browser to [http://localhost:3000](http://localhost:3000). Next.js proxies all `/api/*` and `/health` requests to `http://localhost:8000` automatically.

---

## Section 8 — Verification Checklist

Verify your setup by going through this checklist:

* [ ] **Automated Backend Tests**: With the virtual environment active, run pytest:
  ```bash
  cd harvestiq-engine
  pytest
  ```
  All tests must pass.
* [ ] **Deployment Smoke Check**: Run the verification script:
  ```bash
  python scripts/run_smoke_verification.py
  ```
  It must return `Smoke verification: PASS`.
* [ ] **User Authentication Flow**:
  1. Open [http://localhost:3000](http://localhost:3000) (should redirect to `/auth`).
  2. Click **Register**, fill in name, phone number, and password, and submit.
  3. Log out and log back in to verify session cookies are configured correctly.
* [ ] **MongoDB Check**: Log into your MongoDB Compass and check the `users` collection. A new document representing your registered phone number should exist.
* [ ] **Farmer Onboarding**:
  1. Log in. You should see the onboarding questionnaire.
  2. Select Crop (e.g., Wheat), State (e.g., Rajasthan), District (e.g., Bharatpur), and select a sowing date.
  3. Submit. The application should successfully write a document to `farms` and `crop_cycles` and redirect you to the main dashboard.
* [ ] **AI Advisor Integration**:
  1. Access the Advisory page (`/advisory`).
  2. Enter a crop-related query (e.g., "What is the best sowing spacing?").
  3. The service must successfully fetch RAG context chunks from local ChromaDB and render a synthesized answer from Google Gemini.
* [ ] **Disease Recognition Integration**:
  1. Go to the Crop Disease page (`/disease`).
  2. Upload a sample crop leaf image.
  3. The application must identify the pathogen name and output a confidence rating.
* [ ] **Offline Sync Capability**:
  1. In your browser Developer Tools (F12) Network tab, select **Offline**.
  2. Refresh the page. The application must render cache data from local IndexedDB (powered by Zustand offline store) without crashing or freezing.

---

## Section 9 — Common Failure Modes & Troubleshooting

### 1. MongoDB Connection Failed (`ServerSelectionTimeoutError: localhost:27017 connection refused`)
* **Cause**: Your `MONGODB_URI` environment variable is either unset or still pointing to local host `localhost:27017` when MongoDB is not running locally.
* **Fix**: Edit `harvestiq-engine/.env` and update `MONGODB_URI` to point to your MongoDB Atlas cluster URI.

### 2. MongoDB Access Blocked (`SSL: CERTIFICATE_VERIFY_FAILED`)
* **Cause**: On macOS, standard Python installations from python.org do not ship with Root CA certificates, preventing secure SSL handshakes with MongoDB Atlas.
* **Fix**: Install CA certificates by running this script in your terminal:
  ```bash
  /Applications/Python\ 3.12/Install\ Certificates.command
  ```
  *(Note: The codebase uses python `certifi` bundles to mitigate this, but running the macOS command provides OS-level insurance).*

### 3. Gemini API Connection Errors (`RuntimeError: Gemini API key is not configured` or `400 Bad Request`)
* **Cause**: The `GEMINI_API_KEY` environment variable is missing, copy-pasted incorrectly, or expired.
* **Fix**: Open [Google AI Studio](https://aistudio.google.com/), generate a new API key, paste it into `harvestiq-engine/.env` as `GEMINI_API_KEY`, and restart the FastAPI engine.

### 4. API Calls Fail / Frontend 404 / 502 Bad Gateway
* **Cause**: The Next.js dev server is running, but the backend FastAPI engine is not running on port 8000.
* **Fix**: Verify your backend terminal is running. If it crashed, read the terminal logs to trace the exception (likely a MongoDB connection timeout or authentication failure).

### 5. Offline Dashboard Empty / Not Loading
* **Cause**: You are trying to test offline mode before doing the initial onboarding flow online.
* **Fix**: Connect to the internet, complete the onboarding questionnaire, and load the dashboard once so the app stores localized data structures inside the client IndexedDB container.

---

## Section 10 — Handoff Checklist (What I Must Share)

When transferring the codebase to the new developer, use this table:

| Asset | Safe To Share? | Action Required |
| :--- | :---: | :--- |
| **HarvestIQ Core Source Code** | **Yes** | Share the entire directory (excluding `.venv`, `node_modules`, and `.next`). |
| **Package Configurations** | **Yes** | Share `package.json`, `package-lock.json`, and `requirements.txt`. |
| **Database Seed Fixtures** | **Yes** | Share `data/` and `scripts/` directories containing database mock fixtures. |
| **Environmental Templates** | **Yes** | Share `.env.example` and `.env.local.example`. |
| **Developer Secret Files (`.env`, `.env.local`)** | **No** | Do **NOT** copy or share. These contain active passwords, personal keys, and private cluster paths. |
| **Google Gemini Key** | **No** | Do **NOT** share your personal Gemini API key. The new developer should generate their own free key from Google AI Studio. |
| **Twilio Credentials** | **No** | Do **NOT** share your Twilio keys. The code automatically bypasses SMS triggers if keys are empty. |
| **Required Env Values List** | **Yes** | Provide the list of environment variables (without active secrets) needed to set up `.env` files. |
| **Atlas Connection (Option A only)** | **Yes (Conditional)** | If using a shared cluster, provide read/write database user credentials and whitelist the new developer's IP address. |
