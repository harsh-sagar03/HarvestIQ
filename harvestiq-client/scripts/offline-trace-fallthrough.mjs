#!/usr/bin/env node
/**
 * Current apiRequest with retry:false — proves fall-through to "Not authenticated"
 * when isOffline401, no IndexedDB cache, no demo fixture, navigator.onLine true.
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
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
  if (r.startsWith("@/")) r = path.join(process.cwd(), "src", r.slice(2));
  return orig.call(this, r, p, m, o);
};
const { apiRequest } = require("../src/lib/api");
const { setAccessToken } = require("../src/lib/auth");

global.window = { navigator: { onLine: true } };
Object.defineProperty(global, "navigator", { value: { onLine: true }, writable: true, configurable: true });
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.fetch = async (url) => {
  console.log("[fetch]", url);
  return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
};
setAccessToken("still-have-jwt");

const endpoints = [
  "/api/v1/soil/records/latest?farm_id=x",
  "/api/v1/health-card?farm_id=x",
];

async function run() {
  for (const p of endpoints) {
    console.log("\n--- retry:false", p, "---");
    try {
      await apiRequest(p, { retry: false });
      console.log("SUCCESS unexpected");
    } catch (e) {
      console.log("ERROR:", e.message, "status=", e.status);
    }
  }
}
run();
