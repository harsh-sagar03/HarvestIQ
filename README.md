# HarvestIQ

Deterministic agricultural intelligence platform — Day 1 foundation (Authentication + Farmer Onboarding).

## Repository structure

```text
HARVESTIQ/
├── harvestiq-engine/     # FastAPI backend
├── harvestiq-client/     # Next.js frontend (PWA-ready scaffold)
├── architecture.md
├── roadmap.md
└── blueprint.md
```

## Prerequisites

- Python 3.12+
- Node.js 20+
- MongoDB Atlas cluster (or local MongoDB)

## Environment variables

### Backend (`harvestiq-engine/.env`)

Copy from `.env.example`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=harvestiq
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
ENVIRONMENT=development
```

### Frontend (`harvestiq-client/.env.local`)

```env
BACKEND_URL=http://localhost:8000
```

The Next.js dev server proxies `/api/*` to the FastAPI backend so HttpOnly refresh cookies remain same-origin.

## Quick start (macOS)

### One-time setup

```bash
# 1. Backend — create venv, install deps, create .env
cd /Users/vishaljaiswal/Desktop/HARVESTIQ/harvestiq-engine
./scripts/setup.sh

# 2. Edit .env and set your MongoDB Atlas URI (required)
#    open -e .env

# 3. Frontend — install deps
cd /Users/vishaljaiswal/Desktop/HARVESTIQ/harvestiq-client
npm install
cp .env.local.example .env.local
```

### Start the app (two terminals)

**Terminal 1 — Backend:**
```bash
cd /Users/vishaljaiswal/Desktop/HARVESTIQ/harvestiq-engine
./scripts/start.sh
```

**Terminal 2 — Frontend:**
```bash
cd /Users/vishaljaiswal/Desktop/HARVESTIQ/harvestiq-client
./scripts/start.sh
```

- Backend API docs: http://localhost:8000/docs
- Frontend app: http://localhost:3000

---

## Setup (manual alternative)

### 1. Backend

```bash
cd harvestiq-engine
python3 -m venv .venv
source .venv/bin/activate          # REQUIRED — activates the virtual environment
pip install -r requirements.txt
cp .env.example .env               # then edit with your MongoDB Atlas URI
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> **Why `uvicorn` was not found:** `uvicorn` is installed inside `.venv`, not globally.
> You must either `source .venv/bin/activate` first, or use `.venv/bin/python -m uvicorn ...`
> (the `./scripts/start.sh` script does this for you).

### 2. Frontend

```bash
cd harvestiq-client
npm install
cp .env.local.example .env.local
npm run dev
```

---

## Troubleshooting

### `zsh: command not found: uvicorn`

The virtual environment is not activated and `uvicorn` is not on your global PATH.

**Fix (pick one):**
```bash
cd harvestiq-engine
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```
Or simply run: `./scripts/start.sh`

### `ServerSelectionTimeoutError: localhost:27017 Connection refused`

MongoDB is not running locally. Your `.env` has `MONGODB_URI=mongodb://localhost:27017` but no local MongoDB server is started.

**Fix:** Set `MONGODB_URI` in `harvestiq-engine/.env` to your **MongoDB Atlas** connection string:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```
In Atlas: Network Access → allow your IP (or `0.0.0.0/0` for dev).

### `SSL: CERTIFICATE_VERIFY_FAILED` (MongoDB Atlas on macOS)

**Cause:** Python from [python.org](https://www.python.org) on macOS (including 3.14) ships without CA certificates until you install them. This is **not** a Motor/PyMongo bug and **not** an Atlas IP issue.

**Safest fix (already applied in code):** The backend uses Mozilla's CA bundle via `certifi` — SSL verification stays enabled.

```bash
cd harvestiq-engine
./scripts/setup.sh          # installs certifi
./scripts/start.sh
```

**Also run once on macOS (python.org installer):**
```bash
/Applications/Python\ 3.14/Install\ Certificates.command
```

**Recommended for production stability:** Use Python **3.12** instead of 3.14:
```bash
brew install python@3.12
cd /Users/vishaljaiswal/Desktop/HARVESTIQ/harvestiq-engine
rm -rf .venv
/opt/homebrew/bin/python3.12 -m venv .venv    # Intel Mac: use `which python3.12`
source .venv/bin/activate
pip install -r requirements.txt
./scripts/start.sh
```

### `bad auth : authentication failed` (after SSL is fixed)

Atlas reached successfully but username/password is wrong.

1. Atlas → **Database Access** → confirm user exists
2. Reset password if unsure
3. Update `MONGODB_URI` in `.env` with the correct credentials
4. URL-encode special characters in passwords (`@` → `%40`, `#` → `%23`)

**Correct URI format:**
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/harvestiq?retryWrites=true&w=majority
MONGODB_DB_NAME=harvestiq
```

### `.zshrc: unmatched "`

This is a **shell config issue**, not a HarvestIQ bug. Your `~/.zshrc` line 4 has a corrupted `PATH` export (missing opening `export PATH="`). It prints on every new terminal but does not block the project if you run commands directly.

**Fix (optional):** Open `~/.zshrc`, find the broken line starting with `m/Cryptexes/...`, and restore it to a valid `export PATH="..."` line or remove it.

## MongoDB collections (Day 1)

| Collection | Purpose |
|---|---|
| `users` | Identity, bcrypt password hash, onboarding flag |
| `sessions` | Hashed refresh tokens with TTL |
| `farms` | Farm profile (state, district, optional GeoJSON boundary) |
| `crop_cycles` | Active crop stub created at onboarding |

## API endpoints (Day 1)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `POST` | `/api/v1/auth/register` | No | Register farmer account |
| `POST` | `/api/v1/auth/login` | No | Login; sets HttpOnly refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Cookie | Rotate access token |
| `POST` | `/api/v1/auth/logout` | Cookie | Revoke session |
| `GET` | `/api/v1/users/me` | Bearer | Current user profile |
| `PUT` | `/api/v1/users/profile` | Bearer | Update name / language |
| `POST` | `/api/v1/onboarding` | Bearer | Atomic farm + crop cycle setup |
| `GET` | `/api/v1/farms/me` | Bearer | Farm and crop profile |

## Authentication model

- **Access token**: JWT returned in JSON, held in browser memory only (15 min).
- **Refresh token**: JWT in HttpOnly cookie (`harvestiq_refresh_token`, path `/api/v1/auth`).
- **Passwords**: bcrypt via `passlib`.

## Testing steps

### Manual UI flow

1. Start backend and frontend.
2. Open http://localhost:3000 → redirects to `/auth`.
3. Register a new account (name, phone, password).
4. Sign in with the same credentials.
5. Complete onboarding (crop, state, district, sowing date).
6. Confirm dashboard shows user and farm details.
7. Sign out and sign in again — session should restore via refresh cookie.

### API checks (curl)

```bash
# Health
curl http://localhost:8000/health

# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210","password":"securepass","name":"Test Farmer"}'

# Login (save cookies)
curl -c cookies.txt -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210","password":"securepass"}'

# Refresh
curl -b cookies.txt -c cookies.txt -X POST http://localhost:8000/api/v1/auth/refresh

# Onboarding (replace TOKEN)
curl -X POST http://localhost:8000/api/v1/onboarding \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"crop_type":"Wheat","state":"Punjab","district":"Ludhiana","sowing_date":"2026-05-01"}'

# Unauthorized farm access
curl -i http://localhost:8000/api/v1/farms/me
```

### Verification checklist

- [ ] Passwords stored as bcrypt hashes in MongoDB (not plaintext)
- [ ] `GET /api/v1/farms/me` without token returns `401`
- [ ] Duplicate phone registration returns `409`
- [ ] Future sowing date returns `422`
- [ ] Login rate limit triggers after 5 attempts in 15 minutes

## Day 2 setup (after Day 1)

```bash
cd harvestiq-engine
./scripts/setup.sh
.venv/bin/python scripts/seed_crop_characteristics.py
.venv/bin/python scripts/backfill_farm_locations.py   # existing Day 1 farms only
./scripts/start.sh
```

Day 2 API endpoints:
- `GET /api/v1/weather/forecast?farm_id={id}`
- `POST /api/v1/crop-cycles`
- `GET /api/v1/crop-cycles/{id}/stage`

Run backend tests: `cd harvestiq-engine && .venv/bin/pytest`

## Day 3+ (not implemented)

FSI, RAG, advisory, disease detection, and offline sync are not yet implemented.
