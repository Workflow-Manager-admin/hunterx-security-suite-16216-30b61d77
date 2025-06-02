const { contextBridge, ipcRenderer } = require("electron");

const VULNSCAN_CHANNELS = {
  START_SCAN: "vulnscan:start_scan",
  SCAN_PROGRESS: "vulnscan:scan_progress",
  SCAN_RESULT: "vulnscan:scan_result",
  CANCEL_SCAN: "vulnscan:cancel_scan",
  // Template management
  TEMPLATE_STATUS: "vulnscan:template_status",
  TEMPLATE_UPDATE: "vulnscan:template_update",
  TEMPLATE_ERROR: "vulnscan:template_error",
  TEMPLATE_EVENT: "vulnscan:template_event"
};

/**
 * Expose a secure API to renderer via contextBridge for Nuclei integration:
 *   - startNucleiScan(params): {target, templates, categories, severities, outputType, mode}
 *   - cancelNucleiScan(scanId)
 *   - onScanProgress(cb): subscribe to findings/progress (returns unsubscribe)
 *   - onScanResult(cb): subscribe to scan finish/cancel/exit (returns unsubscribe)
 *   - getTemplateStatus(): query template status, exists, outdated, errors
 *   - updateTemplates(): trigger update (manual/auto), get results/errors/status
 *   - onTemplateEvent(cb): subscribe to template update/status/error events (returns unsubscribe)
 */

// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld('vulnscanAPI', {
  startNucleiScan: (params) =>
    ipcRenderer.invoke(VULNSCAN_CHANNELS.START_SCAN, params),
  cancelNucleiScan: (scanId) =>
    ipcRenderer.invoke(VULNSCAN_CHANNELS.CANCEL_SCAN, { scanId }),

  /**
   * Subscribe to live scan progress and findings (streamed from backend);
   * Returns an unsubscribe function.
   */
  onScanProgress: (callback) => {
    ipcRenderer.on(VULNSCAN_CHANNELS.SCAN_PROGRESS, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(VULNSCAN_CHANNELS.SCAN_PROGRESS);
  },
  /**
   * Subscribe to scan finished/cancelled/error event;
   * Returns an unsubscribe function.
   */
  onScanResult: (callback) => {
    ipcRenderer.on(VULNSCAN_CHANNELS.SCAN_RESULT, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(VULNSCAN_CHANNELS.SCAN_RESULT);
  },
  /**
   * Query status of Nuclei templates: installed, up-to-date, last updated error msg, etc.
   * Returns: {exists, outdated, lastUpdate, error, details}
   */
  getTemplateStatus: () =>
    ipcRenderer.invoke(VULNSCAN_CHANNELS.TEMPLATE_STATUS),

  /**
   * Trigger a manual template update (calls 'nuclei -update').
   * Returns: {success, updated, error?, output}
   */
  updateTemplates: () =>
    ipcRenderer.invoke(VULNSCAN_CHANNELS.TEMPLATE_UPDATE),

  /**
   * Subscribe to template status/update/error push events from backend.
   * Returns an unsubscribe function.
   */
  onTemplateEvent: (callback) => {
    ipcRenderer.on(VULNSCAN_CHANNELS.TEMPLATE_EVENT, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(VULNSCAN_CHANNELS.TEMPLATE_EVENT);
  }
});

