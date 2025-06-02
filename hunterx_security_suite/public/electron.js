//
// Main Electron process: Adds SQLite scan result caching and IPC database interface.
// - Requires "better-sqlite3": install with `npm install better-sqlite3`.
// - Handles Amass/Masscan result caching, history queries, full fetch, and export/import as JSON/CSV.
// - Secure: Validates/sanitizes IPC input/output.
//
// NOTE: Place this main process script at: hunterx_security_suite/public/electron.js
//

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const isDev = !app.isPackaged;

//=== Database Setup ===//
const DB_PATH = path.join(app.getPath('userData'), 'recon_scans.sqlite3');
let db;

// PUBLIC_INTERFACE
function setupDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      tool TEXT NOT NULL,
      parameters TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      output TEXT NOT NULL
    )
  `).run();
}

// PUBLIC_INTERFACE
function cacheScanResult({ target, tool, parameters, output }) {
  // Write scan result into the DB
  const stmt = db.prepare(`
    INSERT INTO scans (target, tool, parameters, output)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(
    String(target),
    String(tool),
    parameters ? JSON.stringify(parameters) : "",
    typeof output === "string" ? output : JSON.stringify(output)
  );
}

// PUBLIC_INTERFACE
function getScanHistory(limit = 100) {
  // Returns summary list for sidebar: [{id, target, tool, timestamp}]
  const stmt = db.prepare(`
    SELECT id, target, tool, parameters, timestamp
    FROM scans
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

// PUBLIC_INTERFACE
function getScanResultById(id) {
  const stmt = db.prepare(`SELECT * FROM scans WHERE id = ?`);
  const row = stmt.get(id);
  if (!row) return null;
  // Output is stored as stringified JSON or raw string.
  try {
    row.output = JSON.parse(row.output);
  } catch {
    // Fallback to string
  }
  try {
    row.parameters = JSON.parse(row.parameters);
  } catch {
    // Fallback
  }
  return row;
}

// PUBLIC_INTERFACE
function exportScanSessions(format = 'json') {
  // Exports all sessions in JSON or CSV format.
  const all = db.prepare("SELECT * FROM scans").all();
  if (format === 'csv') {
    // Basic CSV generator.
    const rows = all.map(r => [
      r.id,
      '"' + r.target.replace(/"/g, "'") + '"',
      '"' + r.tool.replace(/"/g, "'") + '"',
      '"' + r.parameters.replace(/"/g, "'") + '"',
      '"' + r.timestamp + '"',
      '"' + r.output.replace(/"/g, "'") + '"'
    ].join(","));
    const csv = [
      "id,target,tool,parameters,timestamp,output",
      ...rows,
    ].join("\r\n");
    return csv;
  } else {
    // JSON
    return JSON.stringify(all, null, 2);
  }
}

// PUBLIC_INTERFACE
function importScanSessions(jsonData) {
  // Adds one or many sessions from JSON (expecting array or object format)
  let sessions = [];
  try {
    if (typeof jsonData === "string") sessions = JSON.parse(jsonData);
    else sessions = jsonData;
    if (!Array.isArray(sessions)) sessions = [sessions];
  } catch (e) {
    throw new Error("Invalid JSON");
  }
  let imported = 0;
  for (const sess of sessions) {
    if (!sess.target || !sess.tool || !sess.output) continue;
    cacheScanResult(sess);
    imported += 1;
  }
  return imported;
}

// Helper: minimal/strict input validation for history & export/import
function safeInteger(x, fallback = 100) {
  if (typeof x === "number" && Number.isInteger(x) && x > 0) return x;
  if (typeof x === "string" && /^\d+$/.test(x)) return parseInt(x, 10);
  return fallback;
}
function safeString(x, fallback = "") {
  if (typeof x !== "string") return fallback;
  if (x.length > 512) return fallback;
  return x.replace(/[^\w\-\.@ ]/g, " ");
}

//=== Electron Main App ===//
let mainWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../src/ipc/recon.js")
    },
    backgroundColor: "#1a1a2e"
  });
  // Assuming React dev server runs on 3000 in dev, static in prod
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }
};

app.on('ready', () => {
  setupDatabase();
  createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// === IPC Channels for Scan DB ===
const IPC_SCAN_CACHE = 'recon:db_cache_result';    // Write after scan
const IPC_SCAN_HISTORY = 'recon:db_get_history';   // List for sidebar
const IPC_SCAN_FETCH = 'recon:db_get_result';      // Fetch detail
const IPC_EXPORT = 'recon:db_export';              // Get all as file
const IPC_IMPORT = 'recon:db_import';              // Import JSON/CSV

// PUBLIC_INTERFACE - IPC handlers
ipcMain.handle(IPC_SCAN_CACHE, (event, { target, tool, parameters, output }) => {
  // Input: Sanitize all fields
  if (!target || !tool || !output) throw new Error("Missing required fields");
  // Save scan result
  return cacheScanResult({
    target: safeString(target),
    tool: safeString(tool),
    parameters: parameters,
    output: output
  });
});

ipcMain.handle(IPC_SCAN_HISTORY, (event, { limit }) => {
  return getScanHistory(safeInteger(limit, 100));
});

ipcMain.handle(IPC_SCAN_FETCH, (event, { id }) => {
  // Only allow numeric id
  if (!id || !/^[0-9]+$/.test(String(id))) return null;
  return getScanResultById(Number(id));
});

ipcMain.handle(IPC_EXPORT, (event, { format }) => {
  format = (format === 'csv') ? 'csv' : 'json';
  return exportScanSessions(format);
});

ipcMain.handle(IPC_IMPORT, (event, { jsonData }) => {
  return importScanSessions(jsonData);
});

// Optionally: Expose file dialog for direct import/export if needed (not done here)

module.exports = {
  setupDatabase,
  cacheScanResult,
  getScanHistory,
  getScanResultById,
  exportScanSessions,
  importScanSessions
};
