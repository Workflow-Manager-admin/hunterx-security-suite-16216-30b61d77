import React, { createContext, useContext, useState, useEffect, useRef } from "react";

/**
 * VulnScanner state and IPC context for Nuclei (via Electron IPC bridge).
 * Supplies scan control, status, findings array, streaming progress, error state, and controls.
 */
const NucleiScannerContext = createContext();

/**
 * PUBLIC_INTERFACE
 * useNucleiScan() - use in VulnScanner to access scan state and actions.
 */
export function useNucleiScan() {
  return useContext(NucleiScannerContext);
}

/**
 * PUBLIC_INTERFACE
 * NucleiScannerProvider: wraps children with scan state/context and hooks into IPC.
 */
export function NucleiScannerProvider({ children }) {
  // Scan params/state
  const [scanTarget, setScanTarget] = useState("");
  const [scanMode, setScanMode] = useState("quick"); // "quick" | "advanced"
  const [filters, setFilters] = useState({
    severity: "",
    category: "",
    template: "",
  });
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("idle"); // "idle" | "scanning" | "finished" | "error"
  const [findings, setFindings] = useState([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const scanIdRef = useRef(null);

  // Initiate scan via IPC
  // PUBLIC_INTERFACE
  const startScan = async ({ target, mode, severities, categories, templates }) => {
    setError("");
    setScanStatus("scanning");
    setIsScanning(true);
    setFindings([]);
    setProgress("");
    // Accept filters as params or pull from context
    const params = {
      target: target || scanTarget,
      mode: mode || scanMode,
      severities: severities || (filters.severity ? [filters.severity] : undefined),
      categories: categories || (filters.category ? [filters.category] : undefined),
      templates: templates || (filters.template ? [filters.template] : undefined),
      outputType: "json",
    };
    try {
      const res = await window.vulnscanAPI.startNucleiScan(params);
      if (res && res.scanId) {
        scanIdRef.current = res.scanId;
      } else if (res && res.error) {
        setScanStatus("error");
        setError(res.error);
        setIsScanning(false);
        scanIdRef.current = null;
        return;
      }
      setScanStatus("scanning");
      setIsScanning(true);
    } catch (e) {
      setScanStatus("error");
      setIsScanning(false);
      setError("Failed to start Nuclei scan: " + (e.message || "Unknown error"));
      scanIdRef.current = null;
    }
  };

  // Cancel scan via IPC
  // PUBLIC_INTERFACE
  const cancelScan = () => {
    if (scanIdRef.current) {
      window.vulnscanAPI.cancelNucleiScan(scanIdRef.current);
    }
    setIsScanning(false);
    setScanStatus("idle");
    setError("");
    setProgress("");
    scanIdRef.current = null;
  };

  // Live scan streaming: subscribe on mount, clean up on unmount
  useEffect(() => {
    // Progress & findings stream (called for every chunk/finding)
    const unsubProgress = window.vulnscanAPI.onScanProgress((data) => {
      if (data.error) {
        setScanStatus("error");
        setError(data.error || "Scan failed");
        setIsScanning(false);
        setProgress("");
        return;
      }
      // If finding present, append/update
      if (data.result) {
        setFindings((prev) => [...prev, data.result]);
      }
      if (data.progress) setProgress(data.progress);
    });

    // Scan finished/cancelled handler
    const unsubResult = window.vulnscanAPI.onScanResult((data) => {
      // data: {scanId, exitCode, message, error?}
      if (data.error) {
        setScanStatus("error");
        setError(data.error);
        setIsScanning(false);
        setProgress("");
        scanIdRef.current = null;
      } else {
        setScanStatus("finished");
        setIsScanning(false);
        setProgress(data.message || "Scan complete");
        scanIdRef.current = null;
      }
    });

    return () => {
      unsubProgress && unsubProgress();
      unsubResult && unsubResult();
    };
    // We purposely leave [] deps: effect runs once.
    // eslint-disable-next-line
  }, []);

  const contextValue = {
    scanTarget, setScanTarget,
    scanMode, setScanMode,
    filters, setFilters,
    isScanning,
    scanStatus, setScanStatus,
    findings, setFindings,
    progress, setProgress,
    error, setError,
    startScan,
    cancelScan,
  };

  return (
    <NucleiScannerContext.Provider value={contextValue}>
      {children}
    </NucleiScannerContext.Provider>
  );
}
