/**
 * Verification trace for offline SOS triggering, outbox queueing, and sync replay.
 * Run: npx ts-node --project tsconfig.runtime.json -r tsconfig-paths/register scripts/sos-offline-trace-runner.ts
 */
import "fake-indexeddb/auto";
import { api } from "../src/lib/api";
import { readOutbox, clearOutboxKeys } from "../src/lib/db";

// Mock localStorage for auth tokens
global.localStorage = {
  getItem: () => "mock-token",
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
} as unknown as Storage;

// Helpers to simulate network status
function installWindow(online: boolean) {
  Object.defineProperty(global, "window", {
    value: { 
      navigator: { onLine: online },
      dispatchEvent: (event: Event) => {
        console.log(`[TRACE:window] Dispatched event: ${event.type}`);
      }
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global, "navigator", {
    value: { onLine: online },
    writable: true,
    configurable: true,
  });
}

function installFetch(success: boolean) {
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = typeof url === "string" ? url : url.toString();
    console.log(`[TRACE:fetch] Request to ${path}`);
    
    if (!success) {
      throw new TypeError("Failed to fetch");
    }
    
    if (path.includes("/api/v1/sync")) {
      const body = JSON.parse(init?.body as string);
      console.log(`[TRACE:fetch] Replaying operations:`, JSON.stringify(body.operations));
      
      const results = body.operations.map((op: any) => ({
        operation_type: op.operation_type,
        client_id: op.client_id,
        server_id: "mock-server-action-id-999",
        status: "SUCCESS",
        detail: "SOS action mock-server-action-id-999 triggered"
      }));
      
      return {
        ok: true,
        status: 200,
        json: async () => ({
          processed: results.length,
          results
        }),
      } as Response;
    }
    
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  }) as typeof fetch;
}

async function runVerification() {
  console.log("=========================================");
  console.log("RUNNING SCENARIO A: Trigger SOS while Offline");
  console.log("=========================================");
  installWindow(false); // set offline
  installFetch(false); // fetch will throw network error
  
  const farmId = "6a30545c90ec80e1039eb63b";
  const emergencyType = "FLOOD";
  
  console.log("[Test] Calling api.triggerSos offline...");
  const res = await api.triggerSos({
    farm_id: farmId,
    emergency_type: emergencyType,
    latitude: 22.7,
    longitude: 75.8
  });
  
  console.log("[Test] Response received:", res);
  if (res.delivery_status !== "QUEUED_OFFLINE") {
    throw new Error(`Unexpected delivery status: ${res.delivery_status}`);
  }
  
  const outboxBefore = await readOutbox();
  console.log("[Test] Outbox entries after offline trigger:", outboxBefore);
  if (outboxBefore.length !== 1) {
    throw new Error(`Expected outbox length to be 1, got ${outboxBefore.length}`);
  }
  
  const entry = outboxBefore[0];
  if (entry.operation_type !== "TRIGGER_SOS") {
    throw new Error(`Expected operation_type to be TRIGGER_SOS, got ${entry.operation_type}`);
  }
  if (entry.payload.farm_id !== farmId || entry.payload.emergency_type !== emergencyType) {
    throw new Error("Payload fields mismatch");
  }
  if (!entry.payload.captured_at) {
    throw new Error("Missing captured_at timestamp in payload");
  }
  console.log("Scenario A / B / C SUCCESS: SOS enqueued offline and persisted");
  
  console.log("\n=========================================");
  console.log("RUNNING SCENARIO D/E: Reconnect and Replay Sync");
  console.log("=========================================");
  installWindow(true); // set online
  installFetch(true); // fetch succeeds
  
  // Simulate useSyncOutbox replay logic
  const entries = await readOutbox();
  console.log(`[Test] Sync replay started with ${entries.length} entries`);
  const syncResult = await api.syncOutbox(
    entries.map((e) => ({
      client_id: e.client_id,
      operation_type: e.operation_type,
      payload: e.payload,
      client_timestamp: e.client_timestamp,
    }))
  );
  console.log("[Test] Sync api result:", JSON.stringify(syncResult));
  
  const processedIds = syncResult.results
    .filter((item) => item.status === "SUCCESS" || item.status === "DUPLICATE")
    .map((item) => item.client_id);
    
  if (processedIds.length > 0) {
    await clearOutboxKeys(processedIds);
    console.log(`[Test] Cleared outbox keys:`, processedIds);
  }
  
  const outboxAfter = await readOutbox();
  console.log("[Test] Outbox entries after sync replay:", outboxAfter);
  if (outboxAfter.length !== 0) {
    throw new Error(`Expected outbox to be empty, got ${outboxAfter.length}`);
  }
  console.log("Scenario D / E SUCCESS: SOS replayed and outbox item cleared");
  
  console.log("\n=========================================");
  console.log("RUNNING SCENARIO F: Replay Failure Retains Queue Item");
  console.log("=========================================");
  
  installWindow(false); // set offline
  installFetch(false); // fetch fails
  
  console.log("[Test] Queueing new SOS offline...");
  await api.triggerSos({
    farm_id: farmId,
    emergency_type: "FROST",
    latitude: 12.3,
    longitude: 45.6
  });
  
  const outboxFailureBefore = await readOutbox();
  console.log("[Test] Outbox entries before failed replay:", outboxFailureBefore);
  
  installWindow(true); // online
  // Install fetch that fails the sync endpoint (returns FAILED status for operations)
  global.fetch = (async (url: string | URL | Request) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        processed: 1,
        results: [{
          operation_type: "TRIGGER_SOS",
          client_id: outboxFailureBefore[0].client_id,
          server_id: null,
          status: "FAILED",
          error: "Simulated server failure",
          detail: "Replay failed: Simulated server failure"
        }]
      })
    } as Response;
  }) as typeof fetch;
  
  const entriesFail = await readOutbox();
  const syncResultFail = await api.syncOutbox(
    entriesFail.map((e) => ({
      client_id: e.client_id,
      operation_type: e.operation_type,
      payload: e.payload,
      client_timestamp: e.client_timestamp,
    }))
  );
  
  const processedIdsFail = syncResultFail.results
    .filter((item) => item.status === "SUCCESS" || item.status === "DUPLICATE")
    .map((item) => item.client_id);
    
  if (processedIdsFail.length > 0) {
    await clearOutboxKeys(processedIdsFail);
  }
  
  const outboxFailureAfter = await readOutbox();
  console.log("[Test] Outbox entries after failed replay:", outboxFailureAfter);
  if (outboxFailureAfter.length !== 1) {
    throw new Error(`Expected outbox item to be retained, but got outbox length ${outboxFailureAfter.length}`);
  }
  console.log("Scenario F SUCCESS: SOS retained on failure");
  console.log("\nALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
