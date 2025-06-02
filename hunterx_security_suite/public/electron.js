const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const VULNSCAN_CHANNELS = {
  START_SCAN: "vulnscan:start_scan",
  SCAN_PROGRESS: "vulnscan:scan_progress",
  SCAN_RESULT: "vulnscan:scan_result",
  CANCEL_SCAN: "vulnscan:cancel_scan"
};

const runningScans = new Map();

/** Validate incoming params for Nuclei scan */
function validateNucleiParams(params) {
  const validated = {};
  if (!params || typeof params !== "object") throw new Error("Params must be object");
  if (!params.target || typeof params.target !== "string" || params.target.length < 2)
    throw new Error("Scan target required");
  validated.target = params.target;
  if (params.templates && Array.isArray(params.templates))
    validated.templates = params.templates.filter(t => typeof t === "string");
  if (params.categories && Array.isArray(params.categories))
    validated.categories = params.categories.filter(c => typeof c === "string");
  if (params.severities && Array.isArray(params.severities))
    validated.severities = params.severities.filter(s => typeof s === "string");
  validated.outputType = ["json", "yaml"].includes(params.outputType) ? params.outputType : "json";
  validated.mode = params.mode === "advanced" ? "advanced" : "quick";
  return validated;
}

/** Build CLI arg array for Nuclei command */
function buildNucleiArgs(params) {
  const args = ["-u", params.target, "-silent"];
  if (params.outputType === "json") args.push("-json");
  else args.push("-yaml");
  if (params.templates && params.templates.length)
    params.templates.forEach(t => args.push("-t", t));
  if (params.categories && params.categories.length)
    args.push("-categories", params.categories.join(","));
  if (params.severities && params.severities.length)
    args.push("-severity", params.severities.join(","));
  return args;
}

// MAIN ELECTRON APP

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#1a1a2e",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // contextBridge preload(s) let you expose secure-backend API to renderer
      preload: path.join(__dirname, "../src/ipc/recon.js"), // Add more preloads for modules via require
      additionalArguments: [
        "--hx-vulnscan-preload=" + path.join(__dirname, "../src/ipc/vulnscan.js"),
      ]
    }
  });

  // Use React dev server in dev, or load from file in prod
  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:3000/");
  } else {
    win.loadFile(path.join(__dirname, "../build/index.html"));
  }
}

// Scan management logic: IPC handlers
ipcMain.handle(VULNSCAN_CHANNELS.START_SCAN, async (event, scanParams) => {
  let win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  try {
    const params = validateNucleiParams(scanParams);
    const args = buildNucleiArgs(params);
    const nucleiPath = "nuclei";
    const child = spawn(nucleiPath, args, { shell: false });

    const scanId = `${Date.now()}-${Math.floor(Math.random() * 1e7)}`;
    runningScans.set(scanId, child);

    let partial = "";
    let exited = false;

    child.stdout.on("data", (data) => {
      try {
        const output = data.toString();
        partial += output;
        if (params.outputType === "json") {
          let lines = partial.split("\n");
          partial = lines.pop();
          for (let l of lines) {
            if (!l.trim()) continue;
            try {
              const finding = JSON.parse(l);
              win.webContents.send(VULNSCAN_CHANNELS.SCAN_PROGRESS, {
                scanId,
                result: finding,
                progress: finding.info && finding.info.name,
              });
            } catch (e) {
              win.webContents.send(VULNSCAN_CHANNELS.SCAN_PROGRESS, {
                scanId,
                progress: l,
              });
            }
          }
        } else {
          win.webContents.send(VULNSCAN_CHANNELS.SCAN_PROGRESS, {
            scanId,
            progress: output,
            result: null,
          });
        }
      } catch (e) {}
    });

    child.stderr.on("data", (data) => {
      win.webContents.send(VULNSCAN_CHANNELS.SCAN_PROGRESS, {
        scanId,
        error: data.toString(),
      });
    });

    child.on("close", (code) => {
      if (exited) return;
      exited = true;
      runningScans.delete(scanId);
      win.webContents.send(VULNSCAN_CHANNELS.SCAN_RESULT, {
        scanId,
        exitCode: code,
        message: code === 0 ? "Scan finished" : `Scan exited with code ${code}`,
      });
    });

    child.on("error", (e) => {
      runningScans.delete(scanId);
      win.webContents.send(VULNSCAN_CHANNELS.SCAN_RESULT, {
        scanId,
        error: e.message || "Failed to start Nuclei process",
      });
    });

    return { scanId };
  } catch (e) {
    win.webContents.send(VULNSCAN_CHANNELS.SCAN_RESULT, {
      error: e.message || String(e),
    });
    return { error: e.message || String(e) };
  }
});

ipcMain.handle(VULNSCAN_CHANNELS.CANCEL_SCAN, async (event, { scanId }) => {
  if (!scanId || !runningScans.has(scanId)) return { error: "Scan not found" };
  try {
    const child = runningScans.get(scanId);
    if (child && !child.killed) {
      child.kill("SIGTERM");
      runningScans.delete(scanId);
    }
    return { message: "Scan cancelled" };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

// Standard Electron app boilerplate
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/**
 * REQUIRE/REGISTER ALL PRELOADS:
 * Preload scripts for IPC bridges MUST be required here so they are included in asar/packaged dist.
 * This ensures contextBridge APIs are available to renderer!
 */
require('../src/ipc/recon.js');
require('../src/ipc/vulnscan.js');
