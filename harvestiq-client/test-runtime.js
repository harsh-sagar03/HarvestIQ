require("fake-indexeddb/auto");
const fs = require('fs');
const path = require('path');

// Mocks
global.window = { navigator: { onLine: true } }; // We simulate the "wifi off but localhost open" state
global.navigator = global.window.navigator;

global.fetch = async (url, options) => {
  return {
    ok: false,
    status: 401,
    json: async () => ({ detail: "Not authenticated" }),
    text: async () => "Not authenticated",
    clone: function() { return this; }
  };
};

require('ts-node').register({
  compilerOptions: { module: 'commonjs', esModuleInterop: true },
  transpileOnly: true
});

const mockAuth = require('module');
const originalRequire = mockAuth.prototype.require;
mockAuth.prototype.require = function(request) {
  if (request.startsWith('@/')) {
    const newPath = path.join(__dirname, 'src', request.replace('@/', ''));
    return originalRequire.call(this, newPath);
  }
  return originalRequire.call(this, request);
};

async function runTest() {
  const { apiRequest } = require('./src/lib/api');
  const { cacheSnapshot } = require('./src/lib/db');
  
  await cacheSnapshot("health", "farm-123", { farm_id: "farm-123", health_score: 99 });
  
  console.log("--- STARTING REQUEST ---");
  try {
    await apiRequest("/api/v1/health-card?farm_id=farm-123");
  } catch (err) {
    console.log("--- CAUGHT ERROR ---");
    console.log("Error Name:", err.name);
    console.log("Error Message:", err.message);
    console.log("Error Status:", err.status);
  }
}

runTest().catch(console.error);
