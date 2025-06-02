const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * This file handles IPC and backend logic for:
 *   - Verifying Nuclei template existence and freshness
 *   - Executing template updates
 *   - Emitting events to renderer for status/errors
 *   - Robust error/success propagation via IPC
 */

// Location of Nuclei templates (default/local, or env override)
function getNucleiTemplateDir() {
  // Allow override via env for dev
  if (process.env.NUCLEI_TEMPLATES)
    return process.env.NUCLEI_TEMPLATES;

  // Try common install locations; fallback to ~/.local/share/nuclei-templates
  const home = process.env.HOME || process.env.USERPROFILE;
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

// Check if templates folder (and key files) exist and are not empty
function checkTemplatesStatus() {
  const tplDir = getNucleiTemplateDir();
  let exists = false, outdated = false, error = null, details = {};
  try {
    exists = fs.existsSync(tplDir) && fs.readdirSync(tplDir).length > 10;
    if (!exists) {
      error = "Nuclei templates not found. Please update/download templates.";
    } else {
      // Check last update (by folder mtime)
      const stat = fs.statSync(tplDir);
      const lastUpdate = stat.mtime;
      const now = new Date();
      const daysOld = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      outdated = daysOld > 8; // more than 8 days triggers update prompt
      details.lastUpdate = lastUpdate;
      details.daysOld = daysOld;
      if (outdated) {
        error = "Nuclei templates may be outdated. Please update.";
      }
      // Also check for some critical category subfolders
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

// Validate a template YAML path before a scan
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

// Run 'nuclei -update' and handle output, errors robustly.
// Emits IPC events to renderer for status.
function runTemplateUpdate(win, cb) {
  // Optionally: pass Electron's main window if you want to send live events
  let output = "";
  let statusSent = false;
  const nucleiCmd = "nuclei";
  const args = ["-update"];
  const proc = spawn(nucleiCmd, args);

  proc.stdout.on("data", (data) => {
    output += data.toString();
    if (win)
      win.webContents.send("vulnscan:template_event", {
        type: "update-progress",
        progress: data.toString()
      });
  });
  proc.stderr.on("data", (data) => {
    output += data.toString();
    if (win)
      win.webContents.send("vulnscan:template_event", {
        type: "update-progress",
        progress: data.toString()
      });
  });
  proc.on("close", (code) => {
    const success = code === 0;
    if (win) {
      win.webContents.send("vulnscan:template_event", {
        type: "update-done",
        success,
        output,
        error: success ? null : "Update failed: non-zero exit (" + code + ")"
      });
    }
    if (cb) cb({
      success,
      updated: success,
      output,
      error: success ? null : "Update failed: non-zero exit (" + code + ")"
    });
    statusSent = true;
  });
  proc.on("error", (err) => {
    output += "\nPROCESS ERROR: " + (err.message || err.toString());
    if (win) {
      win.webContents.send("vulnscan:template_event", {
        type: "update-done",
        success: false,
        output,
        error: "Nuclei template update process error: " + (err.message || err.toString())
      });
    }
    if (cb) cb({
      success: false,
      output,
      error: "Nuclei update process error: " + (err.message || err.toString())
    });
    statusSent = true;
  });
  // NOTE: No return value, results handled via cb/event
}

// Set up all IPC handlers: must call this from your Electron main process entry!
function setupNucleiTemplateIpc(mainWindow) {
  // Return current template status object
  ipcMain.handle("vulnscan:template_status", async (event) => {
    return checkTemplatesStatus();
  });

  // Trigger an update check/update, return result (do not block main)
  ipcMain.handle("vulnscan:template_update", async (event) => {
    return new Promise((resolve) => {
      runTemplateUpdate(mainWindow, (result) => {
        // After update, check status again
        const status = checkTemplatesStatus();
        resolve({ ...result, templateStatus: status });
      });
    });
  });

  // Validate template paths explicitly if needed - not exposed via IPC by default
}

module.exports = {
  checkTemplatesStatus,
  validateTemplatePaths,
  runTemplateUpdate,
  setupNucleiTemplateIpc,
  getNucleiTemplateDir
};

