const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow;
let activeScans = {}; // Track running scan processes

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 770,
    webPreferences: {
      // Enable contextIsolation and preload for secure IPC
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../src/ipc/recon.js')
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({mode: "detach"});
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

// Validate and sanitize params (domain or IP)
function isValidTarget(target) {
  // Simple validation for domain or IPv4 (expand as needed)
  return (
    typeof target === 'string' &&
    (/^([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})$/.test(target) || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(target))
  );
}

// Helper function to spawn a safe scan command
function spawnScanTool(tool, args, channelPrefix, scanId) {
  try {
    const proc = spawn(tool, args, { shell: false });

    // Track for cleanup/cancel
    activeScans[scanId] = proc;

    proc.stdout.on('data', (data) => {
      mainWindow.webContents.send(`${channelPrefix}:scan_progress`, { output: data.toString(), scanId });
    });
    proc.stderr.on('data', (data) => {
      mainWindow.webContents.send(`${channelPrefix}:scan_progress`, { output: data.toString(), scanId, isError: true });
    });
    proc.on('close', (code) => {
      mainWindow.webContents.send(`${channelPrefix}:scan_result`, { done: true, code, scanId });
      delete activeScans[scanId];
    });
    proc.on('error', (err) => {
      mainWindow.webContents.send(`${channelPrefix}:scan_result`, { error: err.message, scanId });
      delete activeScans[scanId];
    });
  } catch (e) {
    mainWindow.webContents.send(`${channelPrefix}:scan_result`, { error: e.message, scanId });
  }
}

// Listen for Amass/Masscan scan requests (secure, only minimal args allowed)
function registerScanHandlers() {
  // Unified handler for backward compat:
  ipcMain.handle('recon:start_scan', async (event, params) => {
    const { target, scanType } = params || {};
    if (!isValidTarget(target)) {
      return { error: 'Invalid target. Use a valid domain or IPv4.' };
    }
    let scanId = `${scanType || 'scan'}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    if (scanType === 'subdomains' || scanType === 'full') {
      // Amass command (strongly restrict/validate params!)
      // Only allow one arg: domain
      const amassArgs = ['enum', '-d', target, '-o', '-', '-noalts'];
      spawnScanTool('amass', amassArgs, 'recon', scanId + '-amass');
    }
    if (scanType === 'ports' || scanType === 'full') {
      // Masscan: restrict to top 1000 ports for safety
      // Masscan requires root, use restricted ports unless configured otherwise
      const masscanArgs = ['-p1-1000', target, '--rate', '3000', '-oL', '-'];
      spawnScanTool('masscan', masscanArgs, 'recon', scanId + '-masscan');
    }
    return { status: 'started', scanId };
  });

  // Cancel scan handler (optional, cleanup child processes)
  ipcMain.handle('recon:cancel_scan', async (event, { scanId }) => {
    const proc = activeScans[scanId];
    if (proc) {
      proc.kill('SIGTERM');
      delete activeScans[scanId];
      return { cancelled: true };
    }
    return { error: 'No such scan running.' };
  });
}

// Application lifecycle
app.on('ready', () => {
  createWindow();
  registerScanHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
