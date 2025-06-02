const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = {
  FETCH_PROGRAMS: "bountyaggregator:fetchPrograms",
  GET_PROGRAMS: "bountyaggregator:getPrograms",
  ADD_TO_RECON: "bountyaggregator:addToRecon",
  REFRESH_STATUS: "bountyaggregator:refreshStatus",
};

// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld("bountyAggregatorAPI", {
  /** Kick off remote fetch-and-refresh for bug bounty programs (optionally force remote update). */
  fetchPrograms: (opts = { force: false }) =>
    ipcRenderer.invoke(CHANNELS.FETCH_PROGRAMS, opts),

  /** Get locally cached programs, optionally with filters: 
      { platform, min, max, scopeTypes:[], search } */
  getPrograms: (filters = {}) => ipcRenderer.invoke(CHANNELS.GET_PROGRAMS, filters),

  /** Add program (scopes) to Recon Dashboard. */
  addToRecon: program => ipcRenderer.invoke(CHANNELS.ADD_TO_RECON, { program }),

  /** Subscribe to refresh status/error events (returns unsubscribe fn). */
  onRefreshStatus: callback => {
    ipcRenderer.on(CHANNELS.REFRESH_STATUS, (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(CHANNELS.REFRESH_STATUS);
  },
});
