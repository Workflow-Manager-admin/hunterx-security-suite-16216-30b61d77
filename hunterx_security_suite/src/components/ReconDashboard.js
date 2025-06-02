import React, { createContext, useContext, useState } from "react";
import "./ReconDashboard.css";

/**
 * ReconContext and hook for managing scan state and results.
 * Extend this context with scan/IPC integration in the future.
 */
const ReconContext = createContext();

export function useRecon() {
  return useContext(ReconContext);
}

// PUBLIC_INTERFACE
export function ReconProvider({ children }) {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState(null); // "subdomains" | "ports" | "full"
  // Placeholder for future: progress, results, status.
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState(null);

  const value = {
    target, setTarget,
    scanType, setScanType,
    status, setStatus,
    results, setResults,
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
