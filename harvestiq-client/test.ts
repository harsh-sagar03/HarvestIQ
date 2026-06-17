import { cacheSnapshot } from "./src/lib/db";
import { apiRequest } from "./src/lib/api";

Object.defineProperty(global, "window", { value: { navigator: { onLine: true } }, writable: true });

global.fetch = async (url, options) => {
  return {
    ok: false,
    status: 401,
    json: async () => ({ detail: "Not authenticated" }),
    text: async () => "Not authenticated",
    clone: function() { return this; }
  } as any;
};

async function runTest() {
  await cacheSnapshot("health", "farm-123", { farm_id: "farm-123", health_score: 99 });
  
  console.log("--- STARTING REQUEST ---");
  try {
    const res = await apiRequest("/api/v1/health-card?farm_id=farm-123", { retry: false });
    console.log("SUCCESS:", res);
  } catch (err: any) {
    console.log("--- CAUGHT ERROR ---");
    console.log("Error Message:", err.message);
    console.log("Error Status:", err.status);
  }
}

runTest().catch(console.error);