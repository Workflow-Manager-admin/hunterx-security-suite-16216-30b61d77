const { contextBridge, ipcRenderer } = require('electron');

const RECON_CHANNELS = {
  START_SCAN: 'recon:start_scan',
  SCAN_PROGRESS: 'recon:scan_progress',
  SCAN_RESULT: 'recon:scan_result'
};

/**
 * Expose a secure API to renderer via contextBridge:
 *   - startReconScan: sends scan params, returns initial response.
 *   - onScanProgress: subscribe to progress events, returns unsubscribe.
 *   - onScanResult: subscribe to result events, returns unsubscribe.
 */
// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld('reconAPI', {
  startReconScan: (target, scanType) => ipcRenderer.invoke(RECON_CHANNELS.START_SCAN, { target, scanType }),
  onScanProgress: (callback) => {
    ipcRenderer.on(RECON_CHANNELS.SCAN_PROGRESS, (event, data) => callback(data));
    // Return unsubscribe:
    return () => ipcRenderer.removeAllListeners(RECON_CHANNELS.SCAN_PROGRESS);
  },
  onScanResult: (callback) => {
    ipcRenderer.on(RECON_CHANNELS.SCAN_RESULT, (event, data) => callback(data));
    // Return unsubscribe:
    return () => ipcRenderer.removeAllListeners(RECON_CHANNELS.SCAN_RESULT);
  }
});
