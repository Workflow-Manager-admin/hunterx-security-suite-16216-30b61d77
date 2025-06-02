const { contextBridge, ipcRenderer } = require('electron');

const RECON_CHANNELS = {
  START_SCAN: 'recon:start_scan',
  SCAN_PROGRESS: 'recon:scan_progress',
  SCAN_RESULT: 'recon:scan_result',
  CANCEL_SCAN: 'recon:cancel_scan',

  // SQLite DB session cache/history/export IPC
  DB_CACHE_RESULT: 'recon:db_cache_result',
  DB_GET_HISTORY: 'recon:db_get_history',
  DB_GET_RESULT: 'recon:db_get_result',
  DB_EXPORT: 'recon:db_export',
  DB_IMPORT: 'recon:db_import'
};

/**
 * Expose a secure API to renderer via contextBridge:
 *   - startReconScan(target, scanType): Starts a scan.
 *   - cancelScan(scanId): Cancels scan by id.
 *   - onScanProgress(callback): Subscribe to progress events, call callback(data).
 *   - onScanResult(callback): Subscribe to scan result/exit, call callback(data).
 *   - cacheScanResult({target, tool, parameters, output}): Store scan in DB.
 *   - fetchScanHistory(limit): Get sidebar history.
 *   - fetchScanSession(id): Retrieve previous result by ID.
 *   - exportScanSessions(format): Export as JSON or CSV.
 *   - importScanSessions(jsonData): Import from JSON.
 */
// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld('reconAPI', {
  startReconScan: (target, scanType) =>
    ipcRenderer.invoke(RECON_CHANNELS.START_SCAN, { target, scanType }),
  cancelScan: (scanId) =>
    ipcRenderer.invoke(RECON_CHANNELS.CANCEL_SCAN, { scanId }),
  /**
   * Listen for progress output from backend (stdout/stderr).
   * Returns an unsubscribe function.
   */
  onScanProgress: (callback) => {
    ipcRenderer.on(RECON_CHANNELS.SCAN_PROGRESS, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(RECON_CHANNELS.SCAN_PROGRESS);
  },
  /**
   * Listen for scan finish/error event.
   * Returns an unsubscribe function.
   */
  onScanResult: (callback) => {
    ipcRenderer.on(RECON_CHANNELS.SCAN_RESULT, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(RECON_CHANNELS.SCAN_RESULT);
  },

  // PUBLIC_INTERFACE
  cacheScanResult: ({ target, tool, parameters, output }) =>
    ipcRenderer.invoke(RECON_CHANNELS.DB_CACHE_RESULT, { target, tool, parameters, output }),

  fetchScanHistory: (limit = 100) =>
    ipcRenderer.invoke(RECON_CHANNELS.DB_GET_HISTORY, { limit }),

  fetchScanSession: (id) =>
    ipcRenderer.invoke(RECON_CHANNELS.DB_GET_RESULT, { id }),

  exportScanSessions: (format = 'json') =>
    ipcRenderer.invoke(RECON_CHANNELS.DB_EXPORT, { format }),

  importScanSessions: (jsonData) =>
    ipcRenderer.invoke(RECON_CHANNELS.DB_IMPORT, { jsonData })
});
