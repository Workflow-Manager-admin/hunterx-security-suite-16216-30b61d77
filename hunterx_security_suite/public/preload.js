const { contextBridge, ipcRenderer } = require('electron');

// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld('api', {
  // Base IPC example
  ping: (msg) => ipcRenderer.invoke('app:ping', msg),
  // Add more safe APIs for renderer here in the future!
});
