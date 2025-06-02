const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

const { setupNucleiTemplateIpc } = require("../src/ipc/vulnscanTemplates");

// All other imports...

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, "../src/ipc/vulnscan.js"),
      // contextIsolation: true -- assumed elsewhere
    },
    show: false
  });
  win.once("ready-to-show", () => win.show());

  // Setup IPC for nuclei template management.
  setupNucleiTemplateIpc(win);

  // Setup IPC for bug bounty aggregator module.
  setupBountyAggregatorIpc(win);

  // ...existing code...
  if (isDev) {
    win.webContents.openDevTools();
  }
  // Standard load code:
  win.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );
}

// Main entry
app.whenReady().then(createWindow);

// ...existing app event handlers
