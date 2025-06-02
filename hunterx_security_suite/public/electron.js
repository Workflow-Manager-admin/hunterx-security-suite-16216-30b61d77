const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Secure channels (avoid arbitrary code exec, validate inputs!)
const RECON_CHANNELS = {
  START_SCAN: 'recon:start_scan',
  SCAN_PROGRESS: 'recon:scan_progress',
  SCAN_RESULT: 'recon:scan_result'
};

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 720,
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: path.join(__dirname, '../src/ipc/recon.js'),
      contextIsolation: true,
      nodeIntegration: false, // Do not allow Node.js in renderer
      enableRemoteModule: false,
      sandbox: true,
    }
  });

  // Serve built React or in dev mode, load localhost
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

/**
 * Validate target as domain or IPv4 address (simple regex, not exhaustive)
 */
function isValidTarget(target) {
  const domainOrIp = /^([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\d{1,3}\.){3}\d{1,3})$/;
  return typeof target === 'string' && domainOrIp.test(target);
}

/**
 * Parse Amass ("normal" mode, text output) lines into result objects.
 */
function parseAmassLine(line) {
  // Amass returns discovered subdomains, e.g. "www.sub.example.com"
  const trimmed = line.trim();
  if (trimmed && trimmed[0] !== '[') { // skip logs like "[INF]..."
    return {
      asset: trimmed,
      type: "subdomain",
      status: "found"
    };
  }
  return null;
}

/**
 * Parse Masscan line (assuming default -oL output, suppress banners).
 */
function parseMasscanLine(line) {
  // Example: "open tcp 80 1.2.3.4"
  const match = line.match(/open\s+(\w+)\s+(\d+)\s+([\d.]+)/);
  if (match) {
    return {
      asset: match[3],
      port: +match[2],
      proto: match[1],
      type: "port",
      status: "open"
    };
  }
  return null;
}

/**
 * Spawn Amass as subdomain scanner.
 */
function runAmass(target, sendProgress, sendResult, scanType = 'subdomains') {
  // Safe args: only allow validated target, no user-controlled flags
  const args = ['enum', '-d', target, '-o', '-'];
  const amass = spawn('amass', args);

  amass.stdout.on('data', data => {
    const lines = String(data).split('\n');
    for (const line of lines) {
      const res = parseAmassLine(line);
      if (res) sendResult(res);
    }
  });

  amass.stderr.on('data', data => {
    sendProgress({ tool: 'amass', msg: String(data).trim() });
  });

  amass.on('close', code => {
    sendProgress({ tool: 'amass', done: true, exitCode: code });
  });
}

/**
 * Spawn Masscan as port scanner.
 */
function runMasscan(target, sendProgress, sendResult, scanType = 'ports') {
  // Safe args: scan top 1000 ports, treat target as IP/range (validate first!)
  const ports = '1-1000';
  // -oL - output list format, parsable; -Pn - no ping, -p <ports>
  const args = ['-p', ports, '--rate', '500', target, '-oL', '-'];
  const masscan = spawn('masscan', args);

  masscan.stdout.on('data', data => {
    const lines = String(data).split('\n');
    for (const line of lines) {
      const res = parseMasscanLine(line);
      if (res) sendResult(res);
    }
  });

  masscan.stderr.on('data', data => {
    sendProgress({ tool: 'masscan', msg: String(data).trim() });
  });

  masscan.on('close', code => {
    sendProgress({ tool: 'masscan', done: true, exitCode: code });
  });
}

// ---- IPC/Electron Secure Handler ----
ipcMain.handle(RECON_CHANNELS.START_SCAN, async (event, { target, scanType }) => {
  // Validate
  if (!isValidTarget(target) || !['subdomains', 'ports', 'full'].includes(scanType)) {
    return { error: 'Invalid scan parameters' };
  }

  // Use event.sender to reply progressively
  const sender = event.sender;

  // Progress and result streaming helpers
  const sendProgress = (obj) => {
    sender.send(RECON_CHANNELS.SCAN_PROGRESS, obj);
  };
  const sendResult = (obj) => {
    sender.send(RECON_CHANNELS.SCAN_RESULT, obj);
  };

  // Dispatch scan(s)
  if (scanType === 'subdomains') {
    runAmass(target, sendProgress, sendResult, scanType);
  } else if (scanType === 'ports') {
    runMasscan(target, sendProgress, sendResult, scanType);
  } else if (scanType === 'full') {
    // Run Amass first, then port scan for each subdomain/IP found
    let discovered = [];
    runAmass(
      target,
      sendProgress,
      (res) => {
        sendResult(res);
        // If domain => run ports on it
        if (res.asset && !discovered.includes(res.asset)) {
          discovered.push(res.asset);
          runMasscan(
            res.asset,
            prog => sendProgress({...prog, asset: res.asset }),
            portRes => sendResult({...portRes, parent: res.asset }),
            'ports'
          );
        }
      },
      scanType
    );
  }
  return { ok: true, started: scanType };
});
