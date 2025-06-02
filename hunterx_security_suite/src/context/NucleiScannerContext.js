import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

/**
 * VulnScanner state and IPC context for Nuclei (via Electron IPC bridge).
 * Supplies scan control, status, findings array, streaming progress, error state, and controls.
 * Expanded: Exposes template health, update controls, and template errors/warnings.
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
 * Utility for classifying template status
 * Returns: { status, error, severity }
 */
function classifyTemplateStatus(statusObj) {
  // statusObj: {exists, outdated, error, details, path}
  if (!statusObj) return { status: "unknown", severity: "error", reason: "Unable to check template status" };
  if (statusObj.error) {
    let sev = "error";
    if (statusObj.error.toLowerCase().includes("outdated")) sev = "warning";
    return { status: "error", severity: sev, reason: statusObj.error };
  }
  if (!statusObj.exists) return { status: "missing", severity: "error", reason: "Templates missing" };
  if (statusObj.outdated) return { status: "outdated", severity: "warning", reason: "Templates outdated" };
  return { status: "ok", severity: "success", reason: null };
}

/**
 * PUBLIC_INTERFACE
 * NucleiScannerProvider: wraps children with scan state/context and hooks into IPC.
 * (Now also exposes template status, update/refresh, event subscription.)
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

  // ==== TEMPLATE STATUS STATE ====
  const [tplStatus, setTplStatus] = useState(null);
  const [tplStatusLoading, setTplStatusLoading] = useState(true);
  const [tplUpdatePending, setTplUpdatePending] = useState(false);
  const [tplEvent, setTplEvent] = useState(null);
  const [tplManualUpdateErr, setTplManualUpdateErr] = useState(null);

  // When scan fails because of templates, we remember scan params
  const retryScanParamsRef = useRef(null);
  const [autoRetryFlag, setAutoRetryFlag] = useState(false);

  // Fetch template status (API call)
  const refreshTemplateStatus = useCallback(async () => {
    setTplStatusLoading(true);
    setTplManualUpdateErr(null);
    try {
      const stat = await window.vulnscanAPI.getTemplateStatus();
      setTplStatus(stat);
    } catch (e) {
      setTplStatus({
        exists: false,
        outdated: false,
        error: "Failed to query template status: " + (e.message || "Unknown error"),
        details: {},
        path: null,
      });
    }
    setTplStatusLoading(false);
  }, []);

  // On mount, fetch template status and wire up template event subscription
  useEffect(() => {
    refreshTemplateStatus();
    const unsubTplEvent = window.vulnscanAPI.onTemplateEvent((data) => {
      setTplEvent(data);
      // If event: status update or error -> refresh status after a short delay
      if (data && (data.type === "update-done" || data.type === "update-progress")) {
        // To avoid flicker, only refetch status when done or after a short debounce
        setTimeout(() => refreshTemplateStatus(), 1000);
      }
      // Handle update error immediately
      if (data && data.type === "update-done" && data.error) {
        setTplManualUpdateErr(data.error);
      }
    });
    return () => {
      unsubTplEvent && unsubTplEvent();
    };
  }, [refreshTemplateStatus]);

  // Manual update handler
  const updateTemplates = useCallback(async () => {
    setTplUpdatePending(true);
    setTplManualUpdateErr(null);
    try {
      const res = await window.vulnscanAPI.updateTemplates();
      // res: {success, updated, output, error, templateStatus}
      setTplStatus(res.templateStatus || null);
      if (res.error) setTplManualUpdateErr(res.error);
      else setTplManualUpdateErr(null);
    } catch (e) {
      setTplManualUpdateErr("Failed to update templates: " + (e.message || "Unknown error"));
    }
    setTplUpdatePending(false);
  }, []);

  // Initiate scan via IPC
  // PUBLIC_INTERFACE
  const startScan = async ({ target, mode, severities, categories, templates } = {}) => {
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

        // If error is template-related, remember params for auto-retry
        if (res.error && res.error.toLowerCase().includes("template")) {
          retryScanParamsRef.current = params;
        }
        return;
      }
      setScanStatus("scanning");
      setIsScanning(true);
    } catch (e) {
      setScanStatus("error");
      setIsScanning(false);
      setError("Failed to start Nuclei scan: " + (e.message || "Unknown error"));
      scanIdRef.current = null;
      // Catch template errors
      if (e.message && e.message.toLowerCase().includes("template")) {
        retryScanParamsRef.current = params;
      }
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
    retryScanParamsRef.current = null;
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
        // If error is template-related, remember params for auto-retry
        if (data.error && data.error.toLowerCase().includes("template")) {
          retryScanParamsRef.current = null; // only allow auto-retry after manual update
        }
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
        // If error is template-related, remember params for auto-retry
        if (data.error && data.error.toLowerCase().includes("template")) {
          retryScanParamsRef.current = null; // only allow auto-retry after manual update
        }
      } else {
        setScanStatus("finished");
        setIsScanning(false);
        setProgress(data.message || "Scan complete");
        scanIdRef.current = null;
        retryScanParamsRef.current = null;
      }
    });

    return () => {
      unsubProgress && unsubProgress();
      unsubResult && unsubResult();
    };
  }, []);

  // Handle auto-retry of scan after manual update/refresh success
  useEffect(() => {
    if (
      !tplUpdatePending &&
      retryScanParamsRef.current &&
      tplStatus &&
      classifyTemplateStatus(tplStatus).status === "ok" &&
      autoRetryFlag
    ) {
      // Clear flag first to avoid loops
      setAutoRetryFlag(false);
      // Retry previous scan
      startScan(retryScanParamsRef.current);
      retryScanParamsRef.current = null;
    }
    // eslint-disable-next-line
  }, [tplStatus, tplUpdatePending, autoRetryFlag]);

  /**
   * Trigger auto-retry on next template status OK (after update)
   */
  const triggerAutoRetry = useCallback(() => {
    setAutoRetryFlag(true);
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
    // Template status & handlers
    nucleiTemplateStatus: tplStatus,
    nucleiTemplateStatusLoading: tplStatusLoading,
    nucleiTemplateEvent: tplEvent,
    classifyTemplateStatus,
    refreshTemplateStatus,
    updateTemplates,
    nucleiTemplateUpdatePending: tplUpdatePending,
    nucleiTemplateManualError: tplManualUpdateErr,
    // For auto-retry after successful update
    autoRetryFlag,
    triggerAutoRetry,
    lastFailedScanParamsRef: retryScanParamsRef,
  };

  return (
    <NucleiScannerContext.Provider value={contextValue}>
      {children}
    </NucleiScannerContext.Provider>
  );
}
