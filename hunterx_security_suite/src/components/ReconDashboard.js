import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import "./ReconDashboard.css";

/**
 * ReconContext and hook for managing scan state and results.
 * Extend this context with scan/IPC integration in the future.
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
export function ReconProvider({ children }) {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState(null); // "subdomains" | "ports" | "full"
  const [status, setStatus] = useState("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);  // [] of live result objects
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

  // Cancel
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
    // Subscribes once on mount
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
 */
// PUBLIC_INTERFACE
export default function ReconDashboard() {
  const {
    target, setTarget,
    scanType, setScanType,
  } = useRecon();

  // Placeholder action (replace with IPC backend integration)
  const handleStartScan = () => {
    // Future: Wire to Electron IPC to start scan
    alert("Scan would start: " + target + " [" + scanType + "]");
  };

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
        />
        <ScanTypeSelector selected={scanType} onChange={setScanType} />
        <button
          className="hx-recon-btn hx-recon-btn-primary"
          onClick={handleStartScan}
          disabled={!target || !scanType}
        >
          Start Scan
        </button>
      </div>
      {/* Placeholder: Status/Progress */}
      <div className="hx-recon-status-row">
        {/* Future: Show spinner/progress, status messages */}
        <span className="hx-recon-status-badge idle">Idle</span>
      </div>
      <div className="hx-recon-content-split">
        {/* Placeholder: Graph */}
        <div className="hx-recon-graph-placeholder">
          <div className="hx-recon-graph-title">Live Results Visualization</div>
          <div className="hx-recon-graph-box">
            {/* Insert SVG/network graph here */}
            <span style={{ opacity: 0.35 }}>Graph/Map coming soon</span>
          </div>
        </div>
        {/* Placeholder: Table */}
        <div className="hx-recon-table-placeholder">
          <div className="hx-recon-table-title">Enumeration Table</div>
          <table className="hx-recon-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {/* Table body will be populated with live results */}
              <tr>
                <td colSpan="5" style={{ textAlign: "center", opacity: 0.40 }}>
                  Results will appear here as targets are discovered.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* Guidance */}
      <div className="hx-recon-tip">
        Tip: Enter a domain/IP and choose a scan type to begin recon. Full recon combines subdomain and port scans automatically.
      </div>
    </section>
  );
}
