#!/usr/bin/env node
/**
 * Simulates PRE-FIX apiRequest fallback (no isOffline401, no force demo).
 * Proves the exact line that produces "Not authenticated" for dashboard widgets.
 */
import "fake-indexeddb/auto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node", esModuleInterop: true },
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

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

const { readCachedSnapshot } = require("../src/lib/db");
const { getAccessToken, setAccessToken, clearAccessToken } = require("../src/lib/auth");

async function readOfflineCache(pathStr) {
  if (pathStr.includes("/health-card")) {
    const farmId = new URL(pathStr, "http://local").searchParams.get("farm_id") ?? "default";
    return readCachedSnapshot("health", farmId);
  }
  return null;
}

/** Legacy fallback — matches broken behavior before isOffline401 + force demo */
async function legacyApiRequest(pathStr) {
  setAccessToken(null); // simulates post-refresh page reload offline (no in-memory JWT)

  global.window = { navigator: { onLine: true } };
  Object.defineProperty(global, "navigator", { value: { onLine: true }, writable: true, configurable: true });

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/auth/refresh")) {
      return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
    }
    return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
  };

  let response;
  let networkError = false;
  try {
    response = await fetch(pathStr, { credentials: "include" });
  } catch {
    networkError = true;
  }

  if (!networkError && response?.status === 401) {
    try {
      await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
    } catch {
      networkError = true;
    }
    clearAccessToken();
    // Legacy: does NOT set networkError when refresh fails with 401 but navigator still "online"
  }

  const isServerError = response && response.status >= 500;

  // LEGACY: only networkError || isServerError — NOT isOffline401
  if (networkError || isServerError) {
    const cached = await readOfflineCache(pathStr);
    if (cached) return cached;
    throw new ApiError("Network unavailable and no cached snapshot found", 0);
  }

  // BREAK POINT: 401 with no cache falls through here
  if (!response.ok) {
    const detail = await response.json();
    const message = detail?.detail ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, detail);
  }

  return response.json();
}

async function main() {
  const path = "/api/v1/health-card?farm_id=farm-real-001";
  console.log("LEGACY apiRequest simulation (online, no JWT, no IndexedDB cache)");
  console.log("PATH:", path);
  try {
    const data = await legacyApiRequest(path);
    console.log("UNEXPECTED SUCCESS:", data);
  } catch (err) {
    console.log("RESULT:", err.name, "|", err.message, "| status=", err.status);
    console.log("RENDERED IN UI: FarmerHealthCard.tsx line ~59 → error.message");
  }
}

main();
