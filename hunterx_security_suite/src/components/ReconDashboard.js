import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import "./ReconDashboard.css";

/**
 * ReconContext and hook for managing scan state and results,
 * now fully supporting IPC scan triggers, real-time event progress, live result streaming, and error state.
 */
const ReconContext = createContext();

export function useRecon() {
  return useContext(ReconContext);
}

/**
 * ReconProvider:
 * State + backend scan wiring. Provides:
 * - target, scanType: input
 * - status: "idle" | "loading" | "progress" | "finished" | "error"
 * - isLoading: scan loading state
 * - error: error string or null
 * - progress: current progress message/string
 * - results: live, parsed array (table, graph)
 * - startScan: function to initiate scan (calls IPC)
 * - cancelScan: cancels scan
 */
// PUBLIC_INTERFACE
export function ReconProvider({ children }) {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState(null); // "subdomains" | "ports" | "full"
  const [status, setStatus] = useState("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]); // [] of live result objects
  const scanIdRef = useRef(null); // store running scan ID if needed for cancel

  // Send scan start request to backend via IPC
  const startScan = async () => {
    setError(null);
    setStatus("loading");
    setIsLoading(true);
    setProgress(null);
    setResults([]);
    try {
      // Call Electron's contextBridge to start the scan
      const res = await window.reconAPI.startReconScan(target, scanType);
      // 'res' could be { scanId } (optional); store if needed for cancel
      if (res && res.scanId) scanIdRef.current = res.scanId;
      setStatus("progress");
    } catch (e) {
      setError("Failed to start scan: " + (e.message || "Unknown error"));
      setStatus("error");
      setIsLoading(false);
    }
  };

  const cancelScan = () => {
    if (scanIdRef.current)
      window.reconAPI.cancelScan(scanIdRef.current);
    setStatus("idle");
    setIsLoading(false);
    setError(null);
    setProgress(null);
    scanIdRef.current = null;
  };

  // Listen for scan progress (IPC, live stdout/stderr stream)
  useEffect(() => {
    const unsubProgress = window.reconAPI.onScanProgress((data) => {
      // data can be string or {progress, ...}
      if (data.error) {
        setStatus("error");
        setError(data.error);
        setIsLoading(false);
      } else {
        setProgress(data.progress || (typeof data === "string" ? data : null));
        setStatus("progress");
      }
    });
    // Listen for scan final results (scan done)
    const unsubResult = window.reconAPI.onScanResult((data) => {
      if (data.error) {
        setStatus("error");
        setError(data.error);
        setIsLoading(false);
        setProgress(null);
        scanIdRef.current = null;
      } else {
        // Amass/Masscan: data.results is array/table. Support streaming updates.
        if (Array.isArray(data.results)) {
          setResults(prev => [...prev, ...data.results]);
        } else if (data.result) {
          setResults(prev => [...prev, data.result]);
        }
        setStatus("finished");
        setProgress("Scan complete");
        setIsLoading(false);
        scanIdRef.current = null;
      }
    });
    // Clean up event listeners on unmount
    return () => {
      unsubProgress && unsubProgress();
      unsubResult && unsubResult();
    };
  }, []);

  const value = {
    target, setTarget,
    scanType, setScanType,
    status, setStatus,
    isLoading,
    error, setError,
    progress, setProgress,
    results, setResults,
    startScan,
    cancelScan,
  };

  return (
    <ReconContext.Provider value={value}>
      {children}
    </ReconContext.Provider>
  );
}

/**
 * Scan type button group component.
 */
function ScanTypeSelector({ selected, onChange }) {
  const scanTypes = [
    { key: "subdomains", label: "Subdomain Scan" },
    { key: "ports", label: "Port Scan" },
    { key: "full", label: "Full Recon" }
  ];

  return (
    <div className="hx-recon-scan-types" role="group" aria-label="Scan Types">
      {scanTypes.map(type => (
        <button
          key={type.key}
          className={`hx-recon-btn ${selected === type.key ? "active" : ""}`}
          onClick={() => onChange(type.key)}
          type="button"
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Main ReconDashboard UI.
 * Wires up UI controls and live IPC output/progress via useRecon (context).
 */
// PUBLIC_INTERFACE
export default function ReconDashboard() {
  const {
    target, setTarget,
    scanType, setScanType,
    status,
    isLoading,
    error,
    progress,
    results,
    startScan,
    cancelScan,
  } = useRecon();

  const handleStartScan = () => startScan();

  const isScanRunning = status === "loading" || status === "progress";
  const isIdle = status === "idle";
  const isDone = status === "finished";
  const isErrored = status === "error";

  // Returns an array if results is array-like, else []
  const currentResults = Array.isArray(results) ? results : [];

  return (
    <section className="hx-module-panel hx-recon-panel" data-module="recon">
      <h2>
        <span role="img" aria-label="radar" style={{ marginRight: 10 }}>📡</span>
        Recon Dashboard
      </h2>
      <p className="hx-recon-desc">
        Unified recon: Subdomain discovery, port scan, and target enumeration powered by Amass & Masscan.<br />
        <span style={{ color: "var(--accent)", fontWeight: 500 }}>Burp Suite-inspired</span> workflow panel.
      </p>
      {/* Input Row */}
      <div className="hx-recon-input-row">
        <input
          className="hx-recon-input"
          type="text"
          placeholder="Enter target domain or IP (e.g., example.com)"
          value={target}
          onChange={e => setTarget(e.target.value)}
          aria-label="Target"
          disabled={isScanRunning}
        />
        <ScanTypeSelector selected={scanType} onChange={setScanType} />
        {isScanRunning ? (
          <button
            className="hx-recon-btn hx-recon-btn-primary"
            onClick={cancelScan}
            type="button"
          >
            Cancel
          </button>
        ) : (
          <button
            className="hx-recon-btn hx-recon-btn-primary"
            onClick={handleStartScan}
            disabled={!target || !scanType || isScanRunning}
            type="button"
          >
            {isIdle || isDone || isErrored ? "Start Scan" : "Start"}
          </button>
        )}
      </div>

      {/* Status/Progress row */}
      <div className="hx-recon-status-row">
        {isIdle && (
          <span className="hx-recon-status-badge idle">Idle</span>
        )}
        {isScanRunning && (
          <>
            <span className="hx-recon-status-badge" style={{ background: "#493879", color: "#ffe" }}>
              {status === "loading" ? "Starting..." : "In Progress"}
            </span>
            {progress &&
              <span style={{ color: "#c0cfff", fontSize: "0.98em", fontFamily: "monospace" }}>
                {progress}
              </span>}
            <span className="hx-recon-spinner" style={{
              display: "inline-block", marginLeft: 12, width: 18, height: 18, border: "3px solid #c6befa",
              borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite"
            }} />
            <style>{'@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}'}</style>
          </>
        )}
        {isDone && (
          <span className="hx-recon-status-badge" style={{ background: "#1b4732", color: "#c6fff5" }}>
            Scan Complete
          </span>
        )}
        {isErrored && (
          <span className="hx-recon-status-badge" style={{ background: "#981a1c", color: "#fff" }}>
            Error
          </span>
        )}
        {error && (
          <span style={{ color: "#ffb4a3", marginLeft: 12, fontWeight: 500, fontSize: "0.99em" }}>
            {error}
          </span>
        )}
      </div>

      <div className="hx-recon-content-split">
        {/* Graph area */}
        <div className="hx-recon-graph-placeholder">
          <div className="hx-recon-graph-title">Live Results Visualization</div>
          <div className="hx-recon-graph-box" style={{overflow: "auto"}}>
            {/* Graph visualization: SVG */}
            <ReconGraph results={currentResults.slice(0, 25)} />
          </div>
        </div>
        {/* Results table + export control */}
        <div className="hx-recon-table-placeholder">
          <div className="hx-recon-table-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>Enumeration Table</span>
            {/* Export controls: CSV/JSON */}
            <span>
              <button
                type="button"
                title="Export as CSV"
                aria-label="Export as CSV"
                tabIndex={0}
                disabled={currentResults.length === 0}
                onClick={() => exportCSV(filteredRows, reconColumns, "recon-results.csv")}
                style={{
                  marginRight: 8,
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 4,
                  fontWeight: 500,
                  fontSize: "1em",
                  cursor: currentResults.length === 0 ? "not-allowed" : "pointer",
                  opacity: currentResults.length === 0 ? 0.6 : 1,
                }}
              >CSV</button>
              <button
                type="button"
                title="Export as JSON"
                aria-label="Export as JSON"
                tabIndex={0}
                disabled={currentResults.length === 0}
                onClick={() => exportJSON(filteredRows, "recon-results.json")}
                style={{
                  background: "var(--panel-bg)",
                  color: "var(--accent)",
                  border: "1.3px solid var(--accent)",
                  padding: "6px 12px",
                  borderRadius: 4,
                  fontWeight: 500,
                  fontSize: "1em",
                  cursor: currentResults.length === 0 ? "not-allowed" : "pointer",
                  opacity: currentResults.length === 0 ? 0.6 : 1,
                }}
              >JSON</button>
            </span>
          </div>
          <div style={{ marginBottom: 7, maxWidth: 390 }}>
            <TableFilter filter={tableFilter} setFilter={setTableFilter} />
          </div>
          <table className="hx-recon-table">
            <thead>
              <tr>
                {reconColumns.map(col => (
                  <th
                    key={col.field}
                    role="columnheader"
                    onClick={() => col.sortable && handleSort(col.field)}
                    style={{ cursor: col.sortable ? "pointer" : "default", userSelect: "none" }}
                    aria-sort={sortBy === col.field ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    tabIndex={col.sortable ? 0 : -1}
                  >
                    {col.label}
                    {col.sortable &&
                      sortBy === col.field &&
                      (sortDir === "asc" ? " ▲" : " ▼")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={reconColumns.length} style={{ textAlign: "center", opacity: 0.40 }}>
                    {isScanRunning ? "Listening for results..." : "Results will appear here as targets are discovered."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id || String(row.asset || row.domain || row.ip || idx)}>
                    <td>{idx + 1}</td>
                    <td style={{ fontFamily: "monospace", color: "#ffeeb0" }}>{row.asset || row.domain || row.ip || "—"}</td>
                    <td style={{ color: "#42fad3" }}>{row.type || row.assetType || row.service || "—"}</td>
                    <td>
                      {row.status ||
                        (row.open !== undefined
                          ? row.open
                            ? <span style={{color:"#38da7c"}}>Open</span>
                            : <span style={{color:"#e94560"}}>Closed</span>
                          : "—")}
                    </td>
                    <td style={{ fontSize: "0.96em", color: "#d8d9e5" }}>{row.notes || row.info || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Guidance */}
      <div className="hx-recon-tip" tabIndex={0}>
        Tip: Enter a domain/IP and choose a scan type to begin recon. Full recon combines subdomain and port scans automatically.
      </div>
    </section>
  );
}

import ReconGraph from "./ReconGraph";
import { exportCSV, exportJSON } from "./ExportUtils";

// --- Local helpers and UI: Table, Graph, Export, Filter ---

// Table columns: customizable, sortable
const reconColumns = [
  { label: "#", field: "__num", sortable: false },
  { label: "Asset", field: "asset_display", sortable: true },
  { label: "Type", field: "assetType", sortable: true },
  { label: "Status", field: "status", sortable: true },
  { label: "Notes", field: "notes", sortable: false },
];

// Local state: sorting and filtering for the table
function TableFilter({ filter, setFilter }) {
  return (
    <input
      type="search"
      className="hx-recon-input"
      placeholder="Quick filter…"
      value={filter}
      onChange={e => setFilter(e.target.value)}
      style={{
        minWidth: 130,
        maxWidth: "98%",
        padding: "6px 13px",
        fontSize: "0.99em"
      }}
      aria-label="Filter table rows"
    />
  );
}
export {
  TableFilter
};

// Compose augmented rows for table processing and search; keep original source properties
function processTableRows(rows) {
  return rows.map((row, idx) => ({
    ...row,
    __num: idx + 1,
    asset_display: row.asset || row.domain || row.ip || "—"
  }));
}

// Extend main React component to use sorting/filtering state
// Wrap the default export, preserving props/signature

// Wrap the exported component
const BaseReconDashboard = ReconDashboard;
function ReconDashboardEnhanced(props) {
  const {
    results,
    isLoading,
    startScan,
    cancelScan,
    ...rest
  } = useRecon();

  // Table sort/filter states
  const [sortBy, setSortBy] = useState("asset_display");
  const [sortDir, setSortDir] = useState("asc");
  const [tableFilter, setTableFilter] = useState("");

  // Encode sorted+filtered view
  const fullRows = useMemo(() => processTableRows(Array.isArray(results) ? results : []), [results]);
  // Filter (case insensitive substring in any field)
  const filteredRows = useMemo(() => {
    if (!tableFilter) return fullRows;
    const filter = tableFilter.toLowerCase();
    return fullRows.filter(row =>
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(filter)
    );
  }, [tableFilter, fullRows]);
  // Sort by column
  const sortedRows = useMemo(() => {
    if (!sortBy || sortBy === "__num") return filteredRows;
    return [...filteredRows].sort((a, b) => {
      if (a[sortBy] == null) return 1;
      if (b[sortBy] == null) return -1;
      if (typeof a[sortBy] === "string" && typeof b[sortBy] === "string") {
        return sortDir === "asc"
          ? a[sortBy].localeCompare(b[sortBy])
          : b[sortBy].localeCompare(a[sortBy]);
      }
      return sortDir === "asc"
        ? a[sortBy] > b[sortBy]
          ? 1
          : -1
        : a[sortBy] < b[sortBy]
        ? 1
        : -1;
    });
  }, [sortBy, sortDir, filteredRows]);
  // Export only visible (sorted/filtered) table state
  // Extended logic for sorting columns when header clicked
  function handleSort(field) {
    if (sortBy === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  // Provide these local table helpers and props
  return (
    <BaseReconDashboard
      {...props}
      sortedRows={sortedRows}
      filteredRows={sortedRows}
      tableFilter={tableFilter}
      setTableFilter={setTableFilter}
      sortBy={sortBy}
      sortDir={sortDir}
      handleSort={handleSort}
      reconColumns={reconColumns}
    />
  );
}
export default ReconDashboardEnhanced;
