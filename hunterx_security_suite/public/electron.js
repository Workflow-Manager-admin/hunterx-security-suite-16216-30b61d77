const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;

// PUBLIC_INTERFACE
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 950,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    show: false,
    title: "HunterX Security Suite",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove default menu (will add custom menu or controls later)
  Menu.setApplicationMenu(null);

  // Load React app
  const startURL = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.loadURL(startURL);

  // Open dev tools automatically in dev
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Cleanup
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// PUBLIC_INTERFACE
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // Keep app for macOS
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // Re-create window when clicking app icon in dock
  if (mainWindow === null) createWindow();
});

// IPC sample setup (for frontend-backend comms)
ipcMain.handle('app:ping', async (_event, arg) => {
  // Example: Respond from main process to renderer
  return `pong: ${arg}`;
});

// (Optional) open links in external browser
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
});

// Live reload in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('electron-reload')(path.join(__dirname, '..'), {
      electron: require(`${path.join(__dirname, '..', 'node_modules', '.bin', 'electron')}`),
    });
  } catch (e) {
    // dev dependency; ignore error
  }
}
