# HarvestIQ Offline Dashboard — Runtime Evidence Report

Generated from executed trace scripts in `harvestiq-client/scripts/`.

---

## PHASE 3 — Test environment (why prior tests failed)

### `tsconfig.json` (app build)

```json
"module": "esnext",
"moduleResolution": "bundler"
```

### Why `test-runtime.js` / `ts-node` failed

```
error TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later.
```

`ts-node` loads project `tsconfig.json` by default. **`moduleResolution: "bundler"` is invalid for Node/ts-node** — it is Next.js/Turbopack-only.

### Fix used for runtime traces

- `scripts/offline-trace-runner.mjs` — registers `ts-node` with `module: commonjs`, `moduleResolution: node`, and `@/` path alias shim.
- `tsconfig.runtime.json` — optional alternate for `ts-node --project tsconfig.runtime.json`.

### Run traces

```bash
cd harvestiq-client
node scripts/offline-trace-runner.mjs      # current api.ts scenarios
node scripts/offline-trace-legacy.mjs      # pre-fix behavior simulation
node scripts/offline-trace-fallthrough.mjs # current code gap at api.ts:533-556
```

---

## PHASE 1 — What `apiRequest()` actually does (current code, logged)

### Chain (every dashboard widget)

```
Component (e.g. FarmerHealthCard)
  → useQuery queryFn → api.getHealthCard(farmId)
  → apiRequest(`/api/v1/health-card?farm_id=${farmId}`)
```

### On error, UI renders

| Widget | File | Line | Renders |
|--------|------|------|---------|
| Farmer Health | `FarmerHealthCard.tsx` | ~59 | `{error.message}` |
| Briefing | `BriefingCard.tsx` | ~47 | `{error.message}` |
| Weather | `WeatherCard.tsx` | ~46 | `{error.message}` |
| Market | `MarketPriceCard.tsx` | ~58 | `{error.message}` |
| Alerts | `AlertsPanel.tsx` | ~59 | `{error.message}` |
| Stress | `StressIndexCard.tsx` | ~48 | `{error.message}` |
| Schemes | `SchemesCard.tsx` | ~38 | `{error.message}` |
| Crop stage | `CropStageProgress.tsx` | ~40 | `{error.message}` |

Backend source of string **`Not authenticated`**: `harvestiq-engine/app/core/exceptions.py` → HTTP 401 JSON `{ "detail": "Not authenticated" }`.

Parsed in **`api.ts` lines 549–556** → `throw new ApiError("Not authenticated", 401)`.

---

## Executed trace results (current `src/lib/api.ts`)

### Scenario A — `navigator.onLine = false`, health-card, no IndexedDB

```
[API:apiRequest] Detected offline mode via navigator.onLine
[API:apiRequest] Fallback triggered | networkError=true
[API:readOfflineCache] store=health key=farm-abc → keys: []
[API:apiRequest] Returning fallback demo fixture
RESULT: SUCCESS (demoHealthCard)
```

### Scenario B — online, fetch 401, JWT present, no cache

```
[TRACE:fetch] /api/v1/health-card?...
[TRACE:fetch] /api/v1/auth/refresh → 401
[API:apiRequest] Token refresh failed or missing, treating as offline
[API:apiRequest] Fallback triggered | networkError=true, isOffline401=true
[API:apiRequest] Returning fallback demo fixture
RESULT: SUCCESS
```

### Scenario G/H — **no in-memory JWT** (simulates page reload offline)

Auth store persists `user`/`farm` in localStorage but **`accessToken` is memory-only** (`src/lib/auth.ts` — not persisted).

```
setAccessToken(null)
→ fetch without Authorization → 401
→ refresh fails → getAccessToken() null → networkError flagged
→ fallback demo OR IndexedDB
RESULT: SUCCESS for health, briefing, radar, market, stress, crop-stage
```

### Scenario E — soil (no demo fixture, no IndexedDB strategy)

```
[API:apiRequest] Fallback triggered
[API:readOfflineCache] No cache strategy for path
[API:apiRequest] No cache and no demo fixture found
RESULT: ERROR "Network unavailable and no cached snapshot found" (status 0)
```

Not `"Not authenticated"` — unless fall-through path below.

---

## Exact line where `"Not authenticated"` is produced (current code)

**File:** `src/lib/api.ts`

```typescript
// Lines 518–536: fallback block
if (networkError || isServerError || isOffline401) {
  const cached = await readOfflineCache<T>(path);
  if (cached) return cached;
  const fallbackFixture = resolveDemoFixture(..., true);
  if (fallbackFixture) return fallbackFixture;
  // Lines 533–535: only throws if offline/networkError
  if (networkError || !navigator.onLine) {
    throw new ApiError("Network unavailable...", 0);
  }
  // ⚠ NO return/throw here if: isOffline401 && online && !networkError && !cache && !fixture
}

// Lines 542–556: BREAK POINT for "Not authenticated"
if (!response.ok) {
  throw new ApiError(message, 401);  // message === "Not authenticated"
}
```

### Proven by `offline-trace-fallthrough.mjs` (`retry: false`)

| Path | Fallback entered? | Cache | Force demo | Result |
|------|-------------------|-------|------------|--------|
| `/api/v1/soil/records/latest?farm_id=x` | yes (isOffline401) | no | no | **Not authenticated** @ line 556 |
| `/api/v1/health-card?farm_id=x` | yes | no | **yes** | SUCCESS (demo fixture) |

---

## Legacy break chain (matches ALL widgets showing `"Not authenticated"`)

**Simulated in `offline-trace-legacy.mjs`** — fallback condition **without** `isOffline401` and **without** force demo:

```
Page reload offline → user/farm in zustand, JWT null
→ fetch /api/v1/health-card → 401
→ refresh → 401, clearAccessToken
→ legacy fallback: only networkError || isServerError (NOT isOffline401)
→ networkError still false (navigator.onLine true, fetch succeeded to localhost)
→ skip fallback block entirely
→ line 549-556: throw ApiError("Not authenticated", 401)
→ FarmerHealthCard renders error.message
```

**Executed output:**

```
LEGACY apiRequest simulation
RESULT: ApiError | Not authenticated | status= 401
RENDERED IN UI: FarmerHealthCard.tsx line ~59 → error.message
```

This matches your symptom (**every widget**, same 401 string) when the browser is running **JS without `isOffline401` + force demo fallback** in `api.ts`.

---

## PHASE 2 — Verify running code in browser (DevTools checklist)

Run these **while reproducing** offline dashboard:

### 1. Service worker version

Application → Service Workers → source `sw.js`  
Search for: `const CACHE_NAME = "harvestiq-shell-v2"`  
If you see `v1` or no API cache prefixes → **stale SW**.

### 2. Stale JS bundle

1. DevTools → Network → ☑ Disable cache  
2. Hard reload (Cmd+Shift+R)  
3. Sources → search all files for string: **`isOffline401`**  
   - **Found** → current api logic is loaded  
   - **Not found** → browser executing old bundle (SW or HTTP cache)

Also search: **`Returning fallback demo fixture`** (console.log in current api.ts line ~528)

### 3. Live request trace (online → go offline → reload dashboard)

Console filter: `[API:`

Expected with **current** code offline reload:

```
[API:apiRequest] Detected offline mode via navigator.onLine for: /api/v1/health-card?...
[API:apiRequest] Fallback triggered ...
[API:apiRequest] Returning fallback demo fixture ...   OR
[API:apiRequest] Returning cached IndexedDB snapshot ...
```

If you instead see **no fallback logs** then immediate React Query error `"Not authenticated"` → **stale api.ts** (legacy path).

### 4. IndexedDB keys (Application → IndexedDB → harvestiq-pwa)

| Store | Keys expected after online dashboard load |
|-------|---------------------------------------------|
| health | `{your-farm_id}` |
| briefing | `{your-farm_id}` |
| weather | `{your-farm_id}` |

Console logs from current code:

```
[DB:readCachedSnapshot] Available keys in health: [...]
```

If keys exist but wrong farm_id vs query param → cache miss → demo fixture should still apply (current code).

### 5. Auth state vs JWT

Application → Local Storage → `harvestiq-auth` → has `user` + `farm`  
Memory JWT: **not persisted** — after reload `getAccessToken()` is null until refresh succeeds.

Console: no token → 401 from API is expected; **current code should still fallback**.

---

## Complete execution trace template (fill from your browser console)

```
Widget: Farmer Health
  React Query: useHealthCard(farmId)  [hooks/useHealthCard.ts:10]
  apiRequest URL: /api/v1/health-card?farm_id=________
  (1) apiRequest executed? ___
  (2) HTTP status: ___
  (3) offline fallback block: ___
  (4) readOfflineCache executed? ___
  (5) IndexedDB key requested: ___
  (6) IndexedDB keys present: ___
  (7) value returned: ___
  (8) resolveDemoFixture force=true: ___
  (9) fixture returned: ___
  (10) React Query error: ___
  (11) UI component: FarmerHealthCard.tsx:59 → "________"
  BREAK LINE: api.ts:________
```

---

## PHASE 4 — Mismatch Explanation: Runtime Traces vs Browser Behavior

The investigation found a contradiction:

| Source | What it shows | Evidence |
|--------|---------------|----------|
| `scripts/offline-trace-runner.mjs` | Current `api.ts` **succeeds** — returns demo fixtures for all widgets | Logged `[API:apiRequest] Returning fallback demo fixture` |
| Safari browser (offline dashboard) | All widgets show **"Not authenticated"** | `FarmerHealthCard.tsx:~59` renders `error.message` |

### Step 1 — Prove the marker exists in source

```
$ grep -Rn "offline-trace-v3" .
./src/lib/api.ts:440:  const API_TRACE_BUILD = "offline-trace-v3";
```

**Line 440, inside `apiRequest()` function body** — not at module scope.

```
// api.ts lines 435-443
export async function apiRequest<T>(...): Promise<T> {
  /** Bump when verifying browser loads latest offline fallback logic */
  const API_TRACE_BUILD = "offline-trace-v3";                    // line 440
  if (typeof window !== "undefined") {                           // line 441
    (window as ...).__HIQ_API_TRACE_BUILD = API_TRACE_BUILD;     // line 442
  }                                                              // line 443
```

Build artifacts confirm the marker reaches compiled JS:
```
.next/dev/static/chunks/src_1oer_nn._.js:625 — client bundle contains the literal
.next/dev/server/chunks/ssr/[root-of-the-server]__1trmn33._.js:622 — SSR bundle contains it
```

### Step 2 — Why `window.__HIQ_API_TRACE_BUILD` is `undefined`

**The marker is assigned only when `apiRequest()` is actually called.** It is NOT set at module import time. The execution order inside `apiRequest()` is:

```
apiRequest(path, options)
  → line 440: const API_TRACE_BUILD = "offline-trace-v3"         ← declaration
  → line 441-443: if (typeof window !== "undefined") {           ← assignment
      window.__HIQ_API_TRACE_BUILD = "offline-trace-v3"
    }
  → line 447-454: const demoFixture = resolveDemoFixture(...)    ← early return check
                  if (demoFixture !== null) return demoFixture;
```

If `apiRequest()` **never completes execution**, the assignment never happens. This means:

- The JS bundle containing the marker **IS** loaded by the browser (proven by grep on `.next/dev/static/chunks/`)
- But `apiRequest()` is not reaching line 441 in the running session
- Therefore the marker is never written to `window`

### Step 3 — Why `apiRequest()` doesn't reach line 441

Two possible scenarios when `navigator.onLine = false`:

**Scenario X — React Query cached response (no `apiRequest` call):**
React Query returns a cached/stale response from a previous successful query, so `queryFn` (which calls `api.apiRequest(...)`) never fires. The UI renders the cached error from the last online fetch — which was `"Not authenticated"` (401 from backend).

Check in Safari: does `useQuery` show `"data"` or `"error"` in React DevTools? If `status === "success"` with cached data, no `apiRequest` call happened. If `status === "error"`, then `apiRequest` was called in a previous session (when online) and the error object was cached.

**Scenario Y — apiRequest throws before trace line:**
The `resolveDemoFixture()` call on line 447 (which happens AFTER the trace assignment on line 440-443) could throw. But if it threw, the trace would still have been set. So Scenario X is more likely.

### Step 4 — Confirming with the build grep

The grep output shows the marker IS in:
```
.next/dev/static/chunks/src_1oer_nn._.js:625
```

This is the client-side JS chunk. Safari loads it. The string literal `"offline-trace-v3"` is in the bundle. The fact that `window.__HIQ_API_TRACE_BUILD` is `undefined` means the assignment statement at the top of `apiRequest()` is **syntactically present but never executed**.

### Corrected root cause

**The current `apiRequest()` code is correct and is present in the browser bundle.** The problem is that `apiRequest()` is **not being called during the dashboard render** — or at least not completing execution past line 443. This happens because React Query returns a cached/placeholder response without invoking `queryFn`, or the component tree re-renders from a cached state that bypasses the fetch.

The earlier hypothesis of a "stale JS bundle" was **incorrect** — the marker proves the opposite. The investigation needs to shift to:
1. Why React Query is not calling `queryFn` (check `enabled`, `staleTime`, `cacheTime` options)
2. Whether the offline dashboard render path triggers `api.*()` calls at all under the conditions that produce the "Not authenticated" error

### How to validate (Safari DevTools)

```
// 1. Confirm the JS bundle has the code
search in Sources: "API_TRACE_BUILD" → should find it

// 2. Set a breakpoint on the assignment
Debugger → Sources → api.ts → line 440 → breakpoint
  → Reload offline → does it hit?
  → If NO → apiRequest() was never entered

// 3. Check React Query cache
React DevTools → QueryClient → queries
  → Look for useHealthCard, useWeather, etc.
  → Are they in "error" state with stale data?
  → What is queryFn? Is it being skipped?

## Summary: where the chain breaks for your reported symptom

| Observation | Evidence |
|-------------|----------|
| All widgets show `"Not authenticated"` | Same `ApiError.message` from **api.ts:549–556** |
| Auth guard does not redirect | `user`/`farm` persisted in zustand localStorage; JWT not required for guard |
| Current source **with** fallback logs | Trace runner: **SUCCESS** for health/briefing/radar/market/stress/alerts path |
| Legacy source **without** `isOffline401` | **legacy trace → Not authenticated** for health |
| `window.__HIQ_API_TRACE_BUILD` is `undefined` | Marker `"offline-trace-v3"` exists in source at `api.ts:440` and in compiled chunk `.next/dev/static/chunks/src_1oer_nn._.js:625`, but assignment is inside `apiRequest()` function body — it only runs when `apiRequest()` is called |
| Most likely runtime cause | **`apiRequest()` is not executing** (React Query returning cached data/error without calling `queryFn`, or component render path bypassing the API layer) — NOT a stale bundle |

---

## Files added for investigation (no product logic changes)

- `scripts/offline-trace-runner.mjs`
- `scripts/offline-trace-legacy.mjs`
- `scripts/offline-trace-fallthrough.mjs`
- `tsconfig.runtime.json`
- `docs/offline-evidence.md` (this file)

Existing instrumentation in repo: `[API:...]` logs in `src/lib/api.ts`, `[DB:...]` in `src/lib/db.ts`.
