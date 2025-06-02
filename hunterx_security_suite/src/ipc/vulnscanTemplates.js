const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * IPC/backend module for robust management of Nuclei template status, updates, error and event propagation.
 *
 * Responsibilities:
 *   - Validate template folder presence/structure for Nuclei scans
 *   - Check staleness/outdated (mtime-based) and critical sub-folder integrity
 *   - Trigger update (nuclei -update) with reliable stdout/stderr handling
 *   - Emit "template_event" live progress and completion (including error) to renderer
 *   - Propagate errors and status via resolve/reject and event, never swallow failures
 *   - Provide direct status and update IPC handlers for renderer (preload) bridge
 *
 * Usage: Call setupNucleiTemplateIpc(mainWindow) from your Electron main process at startup.
 */

// PUBLIC_INTERFACE
function getNucleiTemplateDir() {
  // Allow override via env for dev/test/CI
  if (process.env.NUCLEI_TEMPLATES) return process.env.NUCLEI_TEMPLATES;

  // Try multiple common install locations; fallback to ~/.local/share/nuclei-templates
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const local = path.join(home, ".local", "share", "nuclei-templates");
  const defaultDirs = [
    local,
    path.join(home, "nuclei-templates"),
    "/usr/share/nuclei-templates"
  ];
  for (const p of defaultDirs) {
    if (fs.existsSync(p)) return p;
  }
  return local;
}

// PUBLIC_INTERFACE
function checkTemplatesStatus() {
  const tplDir = getNucleiTemplateDir();
  let exists = false, outdated = false, error = null, details = {};
  try {
    exists = fs.existsSync(tplDir) && fs.readdirSync(tplDir).length > 10;
    if (!exists) {
      error = "Nuclei templates not found. Please update/download templates.";
    } else {
      // Check last update (by folder mtime); outdated = >8d
      const stat = fs.statSync(tplDir);
      const lastUpdate = stat.mtime;
      const now = new Date();
      const daysOld = (now - lastUpdate) / 86400000;
      outdated = daysOld > 8;
      details.lastUpdate = lastUpdate;
      details.daysOld = daysOld;
      if (outdated) error = "Nuclei templates may be outdated. Please update.";
      // Check for critical subfolders (marks as error if missing any)
      const subdirs = ["cves", "fuzzing", "misconfiguration", "default-logins"];
      for (const sdir of subdirs) {
        if (!fs.existsSync(path.join(tplDir, sdir))) {
          exists = false;
          error = `Critical subfolder '${sdir}/' missing in templates!`;
        }
      }
    }
  } catch (e) {
    error = "Failed to check template status: " + (e.message || e.toString());
    exists = false;
  }
  return { exists, outdated, error, details, path: tplDir };
}

// PUBLIC_INTERFACE
function validateTemplatePaths(paths = []) {
  const tplDir = getNucleiTemplateDir();
  const missing = [];
  for (const relPath of paths) {
    const abs = path.join(tplDir, relPath);
    if (!fs.existsSync(abs)) missing.push(relPath);
  }
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * PUBLIC_INTERFACE
 * Run 'nuclei -update' and emit progress/events to renderer ("vulnscan:template_event").
 *   - Ensures all events go to renderer for user visibility (progress, error, done).
 *   - Handles process spawn errors and non-zero exit codes.
 *   - Callback/Promise for direct update result, but always emits events for frontend.
 * @param {BrowserWindow?} win Electron window to send IPC events (optional)
 * @param {function} cb Callback to receive result ({success, updated, output, error})
 */
function runTemplateUpdate(win, cb) {
  let output = "";
  const nucleiCmd = "nuclei";
  const args = ["-update"];
  let done = false;
  let sendEvent = (payload) => {
    if (win && win.webContents) {
      win.webContents.send("vulnscan:template_event", payload);
    }
  };

  let proc;
  try {
    proc = spawn(nucleiCmd, args);
  } catch (e) {
    done = true;
    output += "\nSPAWN ERROR: " + (e.message || e.toString());
    sendEvent({
      type: "update-done",
      success: false,
      output,
      error: "Failed to spawn nuclei: " + (e.message || e.toString())
    });
    if (cb) cb({
      success: false, updated: false, output,
      error: "Failed to spawn nuclei: " + (e.message || e.toString())
    });
    return;
  }

  proc.stdout.on("data", (data) => {
    output += data.toString();
    sendEvent({ type: "update-progress", progress: data.toString() });
  });
  proc.stderr.on("data", (data) => {
    output += data.toString();
    sendEvent({ type: "update-progress", progress: data.toString() });
  });
  proc.on("close", (code) => {
    if (done) return;
    done = true;
    const success = code === 0;
    sendEvent({
      type: "update-done",
      success,
      output,
      error: success ? null : "Update failed: non-zero exit (" + code + ")"
    });
    if (cb)
      cb({
        success,
        updated: success,
        output,
        error: success ? null : "Update failed: non-zero exit (" + code + ")"
      });
  });
  proc.on("error", (err) => {
    if (done) return;
    done = true;
    output += "\nPROCESS ERROR: " + (err.message || err.toString());
    sendEvent({
      type: "update-done",
      success: false,
      output,
      error: "Nuclei template update process error: " + (err.message || err.toString())
    });
    if (cb)
      cb({
        success: false,
        updated: false,
        output,
        error: "Nuclei update process error: " + (err.message || err.toString())
      });
  });
}

// PUBLIC_INTERFACE
function setupNucleiTemplateIpc(mainWindow) {
  // Status query IPC (renderer <- main)
  ipcMain.handle("vulnscan:template_status", async (event) => {
    try {
      return checkTemplatesStatus();
    } catch (e) {
      return {
        exists: false, outdated: false,
        error: "IPC: Failed to check template status: " + (e.message || e.toString()),
        details: {}, path: getNucleiTemplateDir()
      };
    }
  });

  // Trigger manual update IPC with event relay
  ipcMain.handle("vulnscan:template_update", async (event) => {
    return new Promise((resolve) => {
      runTemplateUpdate(mainWindow, (result) => {
        // After update attempt, recheck status so UI reflects new state
        const status = checkTemplatesStatus();
        resolve({ ...result, templateStatus: status });
      });
    });
  });

  // Note: No default event-broadcast handler needed – runTemplateUpdate emits to "vulnscan:template_event" as child progresses
  // If needed in future, add IPC event relay here
}

// PUBLIC_INTERFACE - Module exports for main process use and tests
module.exports = {
  checkTemplatesStatus,
  validateTemplatePaths,
  runTemplateUpdate,
  setupNucleiTemplateIpc,
  getNucleiTemplateDir
};
