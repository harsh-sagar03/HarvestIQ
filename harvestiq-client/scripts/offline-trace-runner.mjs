#!/usr/bin/env node
/**
 * Standalone offline trace — no TypeScript path aliases.
 * Run from harvestiq-client: node scripts/offline-trace-runner.mjs
 */
import "fake-indexeddb/auto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
    target: "ES2020",
    jsx: "react-jsx",
  },
});

const path = require("path");
const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.join(process.cwd(), "src", request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const { cacheSnapshot } = require("../src/lib/db");
const { setAccessToken } = require("../src/lib/auth");
const { apiRequest } = require("../src/lib/api");

const scenarios = [
  { name: "A_offline_health", online: false, behavior: "401", path: "/api/v1/health-card?farm_id=farm-abc", seed: false },
  { name: "B_online_401_health", online: true, behavior: "401", path: "/api/v1/health-card?farm_id=farm-abc", seed: false },
  { name: "C_online_401_health_cached", online: true, behavior: "401", path: "/api/v1/health-card?farm_id=farm-abc", seed: true },
  { name: "D_offline_stress", online: false, behavior: "401", path: "/api/v1/stress-index/farm-abc", seed: false },
  { name: "E_online_401_soil", online: true, behavior: "401", path: "/api/v1/soil/records/latest?farm_id=farm-abc", seed: false },
  { name: "G_online_401_health_no_token", online: true, behavior: "401", path: "/api/v1/health-card?farm_id=farm-abc", seed: false, noToken: true },
  { name: "H_offline_health_no_token", online: false, behavior: "401", path: "/api/v1/health-card?farm_id=farm-abc", seed: false, noToken: true },
  { name: "I_online_401_briefing_no_token", online: true, behavior: "401", path: "/api/v1/briefing/daily?farm_id=farm-abc", seed: false, noToken: true },
  { name: "J_online_401_radar_no_token", online: true, behavior: "401", path: "/api/v1/disease-radar/nearby?farm_id=farm-abc", seed: false, noToken: true },
  { name: "K_online_401_crop_stage_no_token", online: true, behavior: "401", path: "/api/v1/crop-cycles/cycle-1/stage", seed: false, noToken: true },
];

function installFetch() {
  global.fetch = async (url) => {
    const u = String(url);
    console.log("[TRACE:fetch]", u);
    if (u.includes("/auth/refresh")) {
      return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
    }
    return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
  };
}

function setOnline(v) {
  global.window = { navigator: { onLine: v } };
  Object.defineProperty(global, "navigator", {
    value: { onLine: v },
    writable: true,
    configurable: true,
  });
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

async function runScenario(s) {
  console.log("\n" + "=".repeat(70));
  console.log("SCENARIO:", s.name);
  console.log("PATH:", s.path);
  console.log("navigator.onLine:", s.online);
  console.log("=".repeat(70));

  setOnline(s.online);
  installFetch();
  setAccessToken(s.noToken ? null : "test-jwt");

  if (s.seed) {
    await cacheSnapshot("health", "farm-abc", { farm_id: "farm-abc", health_score: 88 });
    console.log("[TRACE:setup] seeded health/farm-abc");
  }

  try {
    const data = await apiRequest(s.path);
    console.log("[TRACE:result] SUCCESS", JSON.stringify(data).slice(0, 120));
    return { scenario: s.name, outcome: "SUCCESS" };
  } catch (err) {
    console.log("[TRACE:result] ERROR", err.name, err.message, "status=", err.status);
    return { scenario: s.name, outcome: `ERROR: ${err.message}` };
  }
}

async function main() {
  console.log("HarvestIQ offline trace — executing apiRequest scenarios\n");
  const results = [];
  for (const s of scenarios) {
    results.push(await runScenario(s));
  }
  console.log("\n" + "#".repeat(70));
  console.log("SUMMARY");
  for (const r of results) {
    console.log(`  ${r.scenario}: ${r.outcome}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
