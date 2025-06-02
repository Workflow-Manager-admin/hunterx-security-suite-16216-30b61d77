const { contextBridge, ipcRenderer } = require('electron');

// -- IPC Channels (must match main process implementation) --
const CHANNELS = {
  GET_PROGRAMS: 'bounty:get_programs',
  REFRESH_PROGRAMS: 'bounty:refresh_programs',
  SYNC_STATUS: 'bounty:sync_status',  // Status events (sync, error, etc)
};

// Helper: Sanitize and validate filters before sending to backend
function sanitizeGetProgramsFilters(filters = {}) {
  // Only allow specific, safe fields
  const {
    platform,         // string: "hackerone", "bugcrowd", "intigriti", or array of such
    minBounty,        // number: minimum bounty value (optional)
    scopeType,        // string: "all", "url", "mobile", "code", "other"
    searchText,       // string: search for program title, company, etc
    rewardType,       // string: "all", "cash", "swag", etc.
    programType,      // string: "public", "private"
    limit,            // number: limit result size
    offset,           // number: for pagination
  } = filters || {};

  const sanitized = {};
  if (typeof platform === 'string' || Array.isArray(platform)) sanitized.platform = platform;
  if (typeof minBounty === 'number' && minBounty >= 0) sanitized.minBounty = minBounty;
  if (typeof scopeType === 'string') sanitized.scopeType = scopeType;
  if (typeof searchText === 'string') sanitized.searchText = searchText.trim().slice(0, 64);
  if (typeof rewardType === 'string') sanitized.rewardType = rewardType;
  if (typeof programType === 'string') sanitized.programType = programType;
  if (typeof limit === 'number' && limit > 0 && limit < 200) sanitized.limit = limit;
  if (typeof offset === 'number' && offset >= 0) sanitized.offset = offset;
  return sanitized;
}

/**
 * Exposed Bounty Aggregator API to renderer (UI). Only allowed, safe, minimal surface.
 * - getPrograms(filters): returns Promise<Program[]>
 * - refreshPrograms(): triggers sync/fetch & returns Promise<{ok, errors?}>
 * - onSyncStatus(cb): subscribe to sync status/progress/error events (returns unsubscribe)
 * - removeSyncStatusListener(cb): removes sync status callback (for manual unsubscription)
 */
// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld('bountyAPI', {
  /**
   * Fetch local DB bounty programs filtered/sorted for UI.
   * @param {Object} filters - {platform, minBounty, scopeType, searchText, ...}
   * @returns {Promise<Array>} Program list
   */
  getPrograms: (filters = {}) => {
    const sanitized = sanitizeGetProgramsFilters(filters);
    return ipcRenderer.invoke(CHANNELS.GET_PROGRAMS, sanitized);
  },

  /**
   * Manually trigger background sync of public bounty programs (all platforms).
   * @returns {Promise<{ok: boolean, errors?: Array<string>}>}
   */
  refreshPrograms: () => ipcRenderer.invoke(CHANNELS.REFRESH_PROGRAMS),

  /**
   * Listen for sync/error/progress events on background fetch/refresh.
   * Returns unsubscribe function.
   * @param {Function} callback - ({ status: string, error?: string, progress?: any })
   */
  onSyncStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on(CHANNELS.SYNC_STATUS, listener);
    // Return unsubscribe
    return () => {
      ipcRenderer.removeListener(CHANNELS.SYNC_STATUS, listener);
    };
  },

  /**
   * Explicitly remove a sync status listener
   * (If user stores a callback and wants to unbind later)
   * @param {Function} callback - The original callback reference
   */
  removeSyncStatusListener: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.removeListener(CHANNELS.SYNC_STATUS, callback);
  },
});
