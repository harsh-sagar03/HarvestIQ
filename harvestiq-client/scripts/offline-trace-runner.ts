/**
 * Runtime trace for offline apiRequest chain.
 * Run: npx ts-node --project tsconfig.runtime.json -r tsconfig-paths/register scripts/offline-trace-runner.ts
 */
import "fake-indexeddb/auto";

import { cacheSnapshot, readCachedSnapshot } from "../src/lib/db";
import { setAccessToken } from "../src/lib/auth";
import { apiRequest } from "../src/lib/api";

type Scenario = {
  name: string;
  online: boolean;
  fetchBehavior: "401" | "network-error" | "200-health";
  seedCache: boolean;
  farmId: string;
};

const scenarios: Scenario[] = [
  {
    name: "A_offline_navigator_health_no_cache",
    online: false,
    fetchBehavior: "network-error",
    seedCache: false,
    farmId: "real-farm-uuid-001",
  },
  {
    name: "B_online_401_health_no_cache_force_demo",
    online: true,
    fetchBehavior: "401",
    seedCache: false,
    farmId: "real-farm-uuid-001",
  },
  {
    name: "C_online_401_health_with_cache_hit",
    online: true,
    fetchBehavior: "401",
    seedCache: true,
    farmId: "real-farm-uuid-001",
  },
  {
    name: "D_offline_stress_index_no_cache",
    online: false,
    fetchBehavior: "network-error",
    seedCache: false,
    farmId: "real-farm-uuid-001",
  },
  {
    name: "E_online_401_soil_no_fixture",
    online: true,
    fetchBehavior: "401",
    seedCache: false,
    farmId: "real-farm-uuid-001",
  },
];

function installFetch(behavior: Scenario["fetchBehavior"], farmId: string) {
  global.fetch = (async (url: string | URL | Request) => {
    const path = typeof url === "string" ? url : url.toString();
    console.log(`[TRACE:fetch] ${path}`);

    if (path.includes("/auth/refresh")) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ detail: "Not authenticated" }),
        text: async () => "Not authenticated",
      } as Response;
    }

    if (behavior === "network-error") {
      throw new TypeError("Failed to fetch");
    }

    if (behavior === "200-health" && path.includes("/health-card")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ farm_id: farmId, health_score: 77, health_band: "GOOD" }),
      } as Response;
    }

    return {
      ok: false,
      status: 401,
      json: async () => ({ detail: "Not authenticated" }),
      text: async () => "Not authenticated",
    } as Response;
  }) as typeof fetch;
}

function installWindow(online: boolean) {
  Object.defineProperty(global, "window", {
    value: { navigator: { onLine: online } },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global, "navigator", {
    value: { onLine: online },
    writable: true,
    configurable: true,
  });
}

async function traceEndpoint(path: string, scenario: Scenario) {
  console.log("\n" + "=".repeat(72));
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`PATH: ${path}`);
  console.log(`navigator.onLine: ${scenario.online}`);
  console.log("=".repeat(72));

  installWindow(scenario.online);
  installFetch(scenario.fetchBehavior, scenario.farmId);
  setAccessToken("trace-test-token");

  if (scenario.seedCache && path.includes("health-card")) {
    await cacheSnapshot("health", scenario.farmId, {
      farm_id: scenario.farmId,
      health_score: 88,
      health_band: "FAIR",
    });
    const keys = await readCachedSnapshot("health", scenario.farmId);
    console.log(`[TRACE:setup] Seeded cache health/${scenario.farmId}:`, keys ? "OK" : "FAIL");
  }

  try {
    const result = await apiRequest(path);
    console.log("[TRACE:result] SUCCESS");
    console.log("[TRACE:result] payload keys:", Object.keys(result as object));
    if ((result as { health_score?: number }).health_score !== undefined) {
      console.log("[TRACE:result] health_score:", (result as { health_score: number }).health_score);
    }
    return { ok: true as const, result };
  } catch (err) {
    const e = err as Error & { status?: number; name?: string };
    console.log("[TRACE:result] ERROR");
    console.log("[TRACE:result] name:", e.name);
    console.log("[TRACE:result] message:", e.message);
    console.log("[TRACE:result] status:", e.status);
    return { ok: false as const, error: e.message, status: e.status };
  }
}

async function main() {
  console.log("HarvestIQ offline apiRequest trace runner");
  console.log("tsconfig.runtime.json uses module=commonjs moduleResolution=node");

  const summary: Array<{ scenario: string; path: string; outcome: string }> = [];

  for (const scenario of scenarios) {
    let path = `/api/v1/health-card?farm_id=${scenario.farmId}`;
    if (scenario.name.startsWith("D_")) {
      path = `/api/v1/stress-index/${scenario.farmId}`;
    }
    if (scenario.name.startsWith("E_")) {
      path = `/api/v1/soil/records/latest?farm_id=${scenario.farmId}`;
    }

    const out = await traceEndpoint(path, scenario);
    summary.push({
      scenario: scenario.name,
      path,
      outcome: out.ok ? "SUCCESS" : `ERROR: ${out.error} (status ${out.status ?? "n/a"})`,
    });
  }

  console.log("\n" + "#".repeat(72));
  console.log("SUMMARY");
  console.log("#".repeat(72));
  for (const row of summary) {
    console.log(`${row.scenario}`);
    console.log(`  path: ${row.path}`);
    console.log(`  outcome: ${row.outcome}`);
  }
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
