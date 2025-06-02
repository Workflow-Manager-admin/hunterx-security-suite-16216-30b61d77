const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");

/**
 * Expose a secure API to the renderer process via Electron's contextBridge.
 * All APIs for renderer<->main IPC communication (i.e., ping, bountyAggregatorAPI) should be registered here.
 */

// Sample: basic ping IPC for diagnostics/dev
contextBridge.exposeInMainWorld("api", {
  /**
   * PUBLIC_INTERFACE
   * Sends a 'app:ping' message to Electron main process and returns the response.
   */
  ping: () => ipcRenderer.invoke("app:ping"),
});

// Dynamically require and execute any existing modules exporting additional contextBridge APIs, e.g., bountyAggregatorAPI
try {
  const baModule = path.join(__dirname, "../src/ipc/bountyAggregator.js");
  if (fs.existsSync(baModule)) {
    require(baModule);
  }
} catch (e) {
  // Ignore errors for dev scaffold; will log if debugging preload fails
}
