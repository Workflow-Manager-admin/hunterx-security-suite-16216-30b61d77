import React, { useMemo, useState } from "react";
import { useNucleiScan } from "../context/NucleiScannerContext";
import { exportCSV, exportJSON } from "./ExportUtils";

// Severity style mapping
const SEVERITY_COLORS = {
  critical: "#e94560",
  high: "#fb8500",
  medium: "#fbce21",
  low: "#56cfe1",
  info: "#cdcbff",
};

// CATEGORY -> badge color mapping
const CATEGORY_COLORS = {
  XSS: "#c7f55c",
  SQLi: "#fd6bff",
  RCE: "#e4788a",
  LFI: "#d9bcff",
  Auth: "#36fee0",
  CVE: "#f9d780",
  SSRF: "#73ebfb",
  "Open-Redirect": "#f9a219",
  Other: "#b6adea",
};

// Sample filters, should be loaded dynamically in future
const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const CATEGORIES = ["XSS", "SQLi", "RCE", "LFI", "Auth", "CVE", "SSRF", "Open-Redirect", "Other"];
const TEMPLATES = [
  "cves/2023/CVE-2023-1234.yaml",
  "fuzzing/xss-reflected.yaml",
  "misc/open-redirect.yaml",
  "misc/jwt-none-bypass.yaml",
];

// Table columns, with PoC column and selection checkboxes
const VULN_COLUMNS = [
  { label: "", field: "__select", width: 22 }, // selection box
  { label: "#", field: "__num", width: 28 },
  { label: "Severity", field: "severity", width: 84 },
  { label: "Template", field: "template", width: 130 },
  { label: "Category", field: "category", width: 84 },
  { label: "Vulnerability", field: "name", width: 200 },
  { label: "Endpoint", field: "target", width: 210 },
  { label: "Evidence", field: "evidence", width: 120 },
  { label: "PoC", field: "__poc", width: 60 },
];

// Helper: Generate PoC code snippets for a finding
function genPoCSnippet(finding, type = "curl") {
  // Best effort - in future consult backend PoC lib per template
  if (!finding || !finding.target) return "# No PoC available";
  const url = finding.target;
  if (type === "curl")
    return `curl -k -X GET "${url}" -H "User-Agent: nuclei"`;
  if (type === "python-requests")
    return (
      `import requests\n` +
      `headers = {"User-Agent": "nuclei"}\n` +
      `r = requests.get("${url}", headers=headers)\n` +
      `print(r.status_code, r.text[:200])`
    );
  if (type === "httpie")
    return `http GET "${url}" 'User-Agent:nuclei'`;
  // Default fallback
  return `curl "${url}"`;
}

// UI: severity badge
function SeverityBadge({ severity }) {
  if (!severity) return <span style={{ opacity: 0.62 }}>[none]</span>;
  const s = severity.toLowerCase();
  const color = SEVERITY_COLORS[s] || "#b1b1c9";
  const bg = color + "30";
  return (
    <span
      style={{
        padding: "2.7px 14px",
        borderRadius: 18,
        background: bg,
        color,
        fontWeight: 700,
        fontSize: "1.02em",
        textTransform: "capitalize",
        border: `1.2px solid ${color}`,
        letterSpacing: "0.02em",
      }}
      title={s.charAt(0).toUpperCase() + s.slice(1)}
    >
      {s}
    </span>
  );
}

// UI: Category badge
function CategoryBadge({ category }) {
  const label = category || "Other";
  const color = CATEGORY_COLORS[label] || "#b6adea";
  const bg = color + "33";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2.7px 11px",
        borderRadius: 16,
        background: bg,
        color,
        fontWeight: 500,
        fontSize: "0.98em",
        border: `1.1px solid ${color}`,
        textTransform: "capitalize",
        letterSpacing: "0.01em",
      }}
      title={label}
    >
      {label}
    </span>
  );
}

// UI: Template chip
function TemplateChip({ template }) {
  return (
    <span
      style={{
        display: "inline-block",
        color: "#fdadc4",
        background: "#30202980",
        border: "1.1px solid #df708a",
        borderRadius: 9,
        padding: "2.3px 9px",
        fontSize: "0.93em",
        marginRight: 2,
      }}
      title={template}
    >
      {template ? (template.length > 26 ? "…" + template.slice(-24) : template) : "—"}
    </span>
  );
}

// UI: Finding table PoC button
function PoCBtn({ onClick, tooltip }) {
  return (
    <button
      className="hx-recon-btn"
      style={{
        border: "1.1px solid #784fff",
        color: "#f3f6ff",
        background: "#202035",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 500,
        padding: "3px 8px",
        marginLeft: 1,
        cursor: "pointer",
        boxShadow: "0 0.5px 3px 0 #29294c20",
      }}
      onClick={onClick}
      title={tooltip || "Show PoC"}
      tabIndex={0}
      aria-label="Show Proof of Concept"
      type="button"
    >
      PoC
    </button>
  );
}

// UI: Modal for PoC snippet and quick copy
function PoCModal({ finding, open, onClose }) {
  const [tab, setTab] = useState("curl");
  if (!open || !finding) return null;
  const kinds = [
    { key: "curl", label: "cURL" },
    { key: "python-requests", label: "Python requests" },
    { key: "httpie", label: "HTTPie" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        left: 0, top: 0, right: 0, bottom: 0,
        background: "rgba(30,32,56, 0.83)",
        zIndex: 1002,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      tabIndex={-1}
      aria-modal="true"
      aria-label="Proof-of-Concept Modal"
      onClick={onClose}
    >
      <div
        style={{
          minWidth: 390,
          background: "#191926",
          border: "2.6px solid #383857",
          borderRadius: 11,
          boxShadow: "0 2px 32px 0 #0d0c19a0",
          padding: "23px 32px 20px 30px",
          color: "#f1f1ff",
          display: "flex",
          flexDirection: "column",
          maxWidth: "96vw",
          maxHeight: "84vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ color: "#b1a7fa", margin: "0 0 5px 0", fontWeight: 500 }}>
            Proof-of-Concept
            <span style={{ fontWeight: 300, marginLeft: 13, color: "#afcfc1", fontSize: "1rem" }}>
              {finding.name ? "— " + finding.name.slice(0, 58) : ""}
            </span>
          </h3>
          <button
            aria-label="Close"
            title="Close"
            type="button"
            tabIndex={0}
            onClick={onClose}
            style={{
              background: "#322234",
              color: "#ecc",
              border: "none",
              fontWeight: 800,
              borderRadius: 6,
              fontSize: 19,
              padding: "2.7px 11px",
              cursor: "pointer",
              marginLeft: 7,
            }}
          >×</button>
        </div>
        <div style={{ marginBottom: 14, fontSize: "1.04em" }}>
          <b>Endpoint:</b> <span style={{ color: "#8af" }}>{finding.target || "—"}</span>
        </div>
        <div style={{ display: "flex", marginBottom: 6, gap: 10 }}>
          {kinds.map(k =>
            <button
              key={k.key}
              style={{
                marginRight: 3,
                color: tab === k.key ? "#fff" : "#e9e6fd",
                background: tab === k.key ? "#7b61ff" : "#211e25",
                fontWeight: tab === k.key ? 700 : 500,
                border: tab === k.key ? "2px solid #a1cfff" : "1.1px solid #464663",
                borderRadius: 7,
                padding: "3px 13px",
                fontSize: "1em",
                cursor: "pointer",
              }}
              onClick={() => setTab(k.key)}
            >
              {k.label}
            </button>
          )}
        </div>
        <pre
          style={{
            background: "#18172d",
            color: "#fffade",
            borderRadius: 7,
            padding: "10px 13px",
            fontFamily: "monospace",
            fontSize: 15,
            marginBottom: 6,
            maxWidth: 480,
            width: "100%",
            overflowX: "auto",
            minHeight: 45
          }}
        >
          {genPoCSnippet(finding, tab)}
        </pre>
        <span>
          <button
            type="button"
            style={{
              background: "#51d497",
              color: "#171722",
              padding: "3.7px 17px",
              border: "none",
              borderRadius: 4,
              fontWeight: 600,
              fontSize: "1.09em",
              marginRight: 10,
              cursor: "pointer",
            }}
            title="Copy PoC to clipboard"
            onClick={() => {
              navigator.clipboard.writeText(genPoCSnippet(finding, tab));
            }}
          >
            Copy
          </button>
        </span>
      </div>
    </div>
  );
}

// UI: Tooltip helper
function Tooltip({ tip, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      tabIndex={0}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show ? (
        <div
          style={{
            position: "absolute",
            top: 30, left: 0, right: "auto",
            background: "#1f1e2a",
            color: "#ffe",
            padding: "6px 14px",
            borderRadius: 8,
            zIndex: 2003,
            fontSize: 13,
            whiteSpace: "nowrap",
            boxShadow: "0 2.5px 8px 0 #23235590",
            border: "1.2px solid #584f5e",
          }}
        >
          {tip}
        </div>
      ) : null}
    </span>
  );
}

/**
 * PUBLIC_INTERFACE
 * VulnScanner panel supporting template status, error banners, update button, and auto-retry logic.
 */
export default function VulnScanner({}) {
  // ==== State ====
  const {
    scanTarget, setScanTarget,
    scanMode, setScanMode,
    filters, setFilters,
    isScanning,
    scanStatus,
    findings,
    progress,
    error, setError,
    startScan,
    cancelScan,
    // Template status and handlers (new additions)
    nucleiTemplateStatus,
    nucleiTemplateStatusLoading,
    nucleiTemplateEvent,
    classifyTemplateStatus,
    refreshTemplateStatus,
    updateTemplates,
    nucleiTemplateUpdatePending,
    nucleiTemplateManualError,
    autoRetryFlag,
    triggerAutoRetry,
    lastFailedScanParamsRef,
  } = useNucleiScan();

  // Table UI state
  const [tableFilter, setTableFilter] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [sortDir, setSortDir] = useState("desc");
  const [selection, setSelection] = useState({}); // id => boolean row selected
  const [showPoCIdx, setShowPoCIdx] = useState(null);

  // Template status logic
  const tplClassifier = classifyTemplateStatus(nucleiTemplateStatus);
  const isTplHealthy = tplClassifier.status === "ok";
  const tplStatusColor =
    tplClassifier.severity === "success"
      ? "#45e098"
      : tplClassifier.severity === "warning"
      ? "#ffa200"
      : "#f24c6c";
  const tplStatusLabel =
    tplClassifier.status === "ok"
      ? "Templates Ready"
      : tplClassifier.status === "outdated"
      ? "Templates Outdated"
      : tplClassifier.status === "error"
      ? "Template Error"
      : tplClassifier.status === "missing"
      ? "Templates Missing"
      : "Unknown";

  // Control scan enable/disable
  const isScanDisabled =
    !isTplHealthy ||
    nucleiTemplateStatusLoading ||
    nucleiTemplateUpdatePending ||
    !scanTarget ||
    isScanning;

  // Auto-retry logic: For UI, we want to display that a scan will be retried after successful update
  const isTemplateScanBlock =
    !isTplHealthy &&
    (tplClassifier.status === "missing" ||
      tplClassifier.status === "error" ||
      tplClassifier.status === "outdated");

  // Manual update/refresh button label
  const updateBtnLabel = nucleiTemplateUpdatePending
    ? "Updating Templates..."
    : "Update Templates";

  // On click, if the last scan failed with template error, set flag to auto-retry after update
  const onManualUpdate = () => {
    // If last template-caused scan error, set auto-retry
    if (lastFailedScanParamsRef && lastFailedScanParamsRef.current) triggerAutoRetry();
    updateTemplates();
  };

  // Handle row selection for export
  function toggleSelectRow(id) {
    setSelection(cur => ({
      ...cur,
      [id]: !cur[id],
    }));
  }
  function selectAllRows(rows) {
    const sel = {};
    rows.forEach(f => {
      if (f.id || f.key) sel[f.id || f.key] = true;
    });
    setSelection(sel);
  }
  function clearSelection() {
    setSelection({});
  }

  function handleExportCSV(rows, columns) {
    exportCSV(rows, columns, "vulnscan-results.csv");
  }
  function handleExportJSON(rows) {
    exportJSON(rows, "vulnscan-results.json");
  }
  function handleExportReport(rows) {
    // Placeholder for reporting integration (PDF, DB, etc)
    alert("Send to Reporting (hook not implemented yet): " + rows.length + " findings.");
  }

  // ==== Filtering, Sorting, Numbering, PoC logic ====
  // Process findings for display
  const numberedFindings = useMemo(
    () =>
      (Array.isArray(findings) ? findings : []).map((f, idx) => ({
        ...f,
        __num: idx + 1,
        __select: !!selection[f.id || f.key],
      })),
    [findings, selection]
  );

  const filteredFindings = useMemo(() => {
    let data = numberedFindings;
    // Global (quick) table filter
    if (tableFilter) {
      const f = tableFilter.toLowerCase();
      data = data.filter(row =>
        Object.values(row)
          .join(" ")
          .toLowerCase()
          .includes(f)
      );
    }
    // Selector panel - severity/category/template
    if (filters.severity) data = data.filter(row => row.severity === filters.severity);
    if (filters.category) data = data.filter(row => row.category === filters.category);
    if (filters.template) data = data.filter(row => row.template === filters.template);
    // Sorting
    if (sortBy) {
      data = [...data].sort((a, b) => {
        if (a[sortBy] == null) return 1;
        if (b[sortBy] == null) return -1;
        if (sortBy === "severity") {
          return SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
        }
        if (typeof a[sortBy] === "string" && typeof b[sortBy] === "string")
          return sortDir === "asc"
            ? a[sortBy].localeCompare(b[sortBy])
            : b[sortBy].localeCompare(a[sortBy]);
        return sortDir === "asc"
          ? a[sortBy] > b[sortBy]
            ? 1
            : -1
          : a[sortBy] < b[sortBy]
          ? 1
          : -1;
      });
      if (sortDir === "desc") data = data.reverse();
    }
    return data;
  }, [numberedFindings, filters, tableFilter, sortBy, sortDir]);

  // List of currently selected findings (for export/report)
  const selectedFindings = useMemo(
    () =>
      filteredFindings.filter(f =>
        f.id ? !!selection[f.id] : false || (f.key ? !!selection[f.key] : false)
      ),
    [filteredFindings, selection]
  );

  // Selection checkbox helpers: header
  const allRowsSelected =
    filteredFindings.length > 0 &&
    filteredFindings.every(f => selection[f.id || f.key]);
  const someSelected =
    selectedFindings.length > 0 && !allRowsSelected;

  // ==== Scan Logic ====
  function handleStartScan() {
    startScan({
      target: scanTarget,
      mode: scanMode,
      severities: filters.severity ? [filters.severity] : undefined,
      categories: filters.category ? [filters.category] : undefined,
      templates: filters.template ? [filters.template] : undefined,
    });
  }
  function handleCancel() {
    cancelScan();
  }
  function handleModeChange(mode) {
    setScanMode(mode);
  }

  // ==== Export controls ====
  function exportCurrentRows(fmt) {
    const expRows = selectedFindings.length > 0 ? selectedFindings : filteredFindings;
    if (fmt === "csv") handleExportCSV(expRows, VULN_COLUMNS.slice(1, -1)); // skip .__select/.poc
    else if (fmt === "json") handleExportJSON(expRows);
    else if (fmt === "report") handleExportReport(expRows);
  }

  // Template status indicator (inline, like health badge, and panel)
  function renderTemplateStatusBadge() {
    return (
      <span
        style={{
          background: tplStatusColor,
          color: "#1a1a2e",
          fontWeight: 700,
          borderRadius: 8,
          fontSize: "1.04em",
          padding: "2.5px 16px",
          marginLeft: 17,
          opacity: nucleiTemplateStatusLoading ? 0.6 : 1,
          letterSpacing: "0.04em",
        }}
        title={`Status: ${tplStatusLabel}`}
        tabIndex={0}
      >
        {tplStatusLabel}
      </span>
    );
  }

  // Error/warning banner panel for template health
  function renderTemplateErrorBanner() {
    if (!isTemplateScanBlock) return null;

    let bannerColor = "#faeaea";
    let textColor = "#C02020";
    let icon = "❌";
    let description = tplClassifier.reason || "Nuclei templates are missing or unusable. Please update or repair templates.";

    if (tplClassifier.severity === "warning") {
      bannerColor = "#fffbe8";
      textColor = "#bb7923";
      icon = "⚠️";
    }
    if (tplClassifier.severity === "success") return null;

    // Remediation instructions
    let remediation = (
      <span>
        {tplClassifier.status === "outdated"
          ? "You should update templates to ensure latest coverage. "
          : "Templates must be installed and up to date for scanner to run. "}
        Use <b>Update Templates</b> below or check your system's template folder.
      </span>
    );
    if (nucleiTemplateManualError) {
      description = nucleiTemplateManualError;
      icon = "❗";
      bannerColor = "#fee6f0";
      textColor = "#be2a60";
    }

    return (
      <div
        role="alert"
        style={{
          background: bannerColor,
          color: textColor,
          padding: "13px 23px",
          border: `2.2px solid ${tplStatusColor}`,
          borderRadius: 8,
          fontWeight: 600,
          marginBottom: 16,
          fontSize: "1.09em",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          position: "relative",
        }}
        tabIndex={0}
      >
        <span style={{ fontSize: "1.5em", lineHeight: 1 }}>{icon}</span>
        <div>
          <b>Templates Not Usable:</b> {description}
          <br />
          <span style={{ fontWeight: 500 }}>{remediation}</span>
          {/* Update/Refresh Button in banner */}
          <div style={{ marginTop: 7 }}>
            <button
              type="button"
              className="hx-recon-btn"
              style={{
                color: "#fff",
                background: tplStatusColor,
                border: 0,
                borderRadius: 6,
                padding: "8px 20px",
                marginRight: 10,
                fontWeight: 700,
                fontSize: "1.08em",
                opacity: nucleiTemplateUpdatePending ? 0.6 : 1,
                cursor: nucleiTemplateUpdatePending ? "wait" : "pointer",
              }}
              disabled={nucleiTemplateUpdatePending}
              onClick={onManualUpdate}
              tabIndex={0}
            >
              {updateBtnLabel}
            </button>
            <button
              type="button"
              className="hx-recon-btn"
              style={{
                color: "#666",
                background: "#eee",
                border: "1.3px solid #aaa",
                borderRadius: 6,
                padding: "7px 15px",
                fontWeight: 600,
                fontSize: "1.01em",
                marginLeft: 2,
                opacity: nucleiTemplateStatusLoading ? 0.4 : 1,
                cursor: nucleiTemplateStatusLoading ? "not-allowed" : "pointer",
              }}
              disabled={nucleiTemplateStatusLoading}
              onClick={refreshTemplateStatus}
              tabIndex={0}
            >
              Refresh Status
            </button>
          </div>
        </div>
        {nucleiTemplateUpdatePending && (
          <span
            style={{
              marginLeft: "auto",
              position: "absolute",
              right: 19,
              top: 6,
              fontWeight: "bold",
              color: "#8494a1",
              fontSize: "0.98em",
              opacity: 0.82,
            }}
          >
            <span className="hx-recon-spinner" style={{
              display: "inline-block",
              marginRight: 10,
              width: 18, height: 18,
              border: "3px solid #ddd",
              borderTop: `3px solid ${tplStatusColor}`,
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            Updating...
            <style>
              {'@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}'}
            </style>
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="hx-module-panel hx-vuln-panel" data-module="scanner">
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span role="img" aria-label="bolt" style={{ fontSize: 28 }}>
          ⚡
        </span>
        Vulnerability Scanner
        {renderTemplateStatusBadge()}
      </h2>
      <p style={{ color: "#d7dfff", marginBottom: 8, fontSize: "1.09em" }}>
        Automated Nuclei scan UI: scan endpoints, filter by template/category, and review findings.{" "}
        <span style={{ color: "var(--accent)", fontWeight: 500 }}>Burp Suite-inspired workflow</span>.
      </p>
      {/* Template Error/Health Banner */}
      {renderTemplateErrorBanner()}

      {/* Scan Target + quick/advanced switching */}
      <div
        className="hx-vuln-input-row"
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        <input
          className="hx-recon-input"
          style={{ minWidth: 250, flex: 4, background: "#19192c" }}
          type="text"
          placeholder="Scan target (URL, domain or IP)"
          value={scanTarget}
          onChange={e => setScanTarget(e.target.value)}
          disabled={isScanning}
          aria-label="Scan target"
        />
        {/* Scan mode switcher */}
        <Tooltip tip="Quick: Category/template filters. Advanced: Custom YAML/payloads.">
          <select
            className="hx-recon-input"
            style={{
              minWidth: 120,
              fontWeight: 500,
              color: "#f4f6ffd9",
              background: "#232344",
              border: "2px solid var(--tab-border)",
            }}
            value={scanMode}
            onChange={e => handleModeChange(e.target.value)}
            disabled={isScanning}
            aria-label="Scan mode"
          >
            <option value="quick">Quick</option>
            <option value="advanced">Advanced</option>
          </select>
        </Tooltip>
        <button
          className="hx-recon-btn hx-recon-btn-primary"
          disabled={!scanTarget || isScanning}
          style={{ minWidth: 92 }}
          onClick={handleStartScan}
        >
          {isScanning ? "Scanning..." : "Start Scan"}
        </button>
        {isScanning ? (
          <button
            className="hx-recon-btn"
            style={{
              background: "#39304a",
              color: "#ebb",
              fontWeight: 500,
              border: "1.8px solid #bcbed7",
            }}
            onClick={handleCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
        {/* Export/Report Controls */}
        <span style={{ marginLeft: 10, display: "flex", gap: 6 }}>
          <Tooltip tip={selectedFindings.length > 0
            ? "Export ONLY selected findings"
            : "Export all current filtered findings"}>
            <button
              className="hx-recon-btn"
              style={{
                background: "var(--panel-bg)",
                border: "1.2px solid var(--accent)",
                color: "var(--accent)",
                fontWeight: 500,
                padding: "7px 12px",
                borderRadius: 5,
                opacity: filteredFindings.length > 0 ? 1 : 0.5,
                cursor: filteredFindings.length > 0 ? "pointer" : "not-allowed",
              }}
              title="Export findings as CSV"
              disabled={filteredFindings.length === 0}
              onClick={() => exportCurrentRows("csv")}
              tabIndex={0}>CSV</button>
          </Tooltip>
          <Tooltip tip={selectedFindings.length > 0
            ? "Export ONLY selected findings"
            : "Export all current filtered findings"}>
            <button
              className="hx-recon-btn"
              style={{
                background: "var(--accent)",
                color: "#fff",
                padding: "7px 12px",
                fontWeight: 600,
                borderRadius: 5,
                opacity: filteredFindings.length > 0 ? 1 : 0.5,
                cursor: filteredFindings.length > 0 ? "pointer" : "not-allowed",
              }}
              title="Export findings as JSON"
              disabled={filteredFindings.length === 0}
              onClick={() => exportCurrentRows("json")}
              tabIndex={0}>JSON</button>
          </Tooltip>
          <Tooltip tip="Send findings to Reporting Suite (PDF/Session)">
            <button
              className="hx-recon-btn"
              style={{
                background: "#2f1c28",
                color: "var(--accent)",
                border: "1.2px solid var(--accent)",
                padding: "7px 12px",
                borderRadius: 5,
                fontWeight: 500,
                fontSize: "1em",
                opacity: filteredFindings.length > 0 ? 1 : 0.5,
                cursor: filteredFindings.length > 0 ? "pointer" : "not-allowed",
              }}
              title="Generate Report (PDF/Session)"
              disabled={filteredFindings.length === 0}
              onClick={() => exportCurrentRows("report")}
              tabIndex={0}>Report</button>
          </Tooltip>
        </span>
      </div>

      {/* Scan Filters - dynamically show for quick/advanced mode */}
      <div
        className="hx-vuln-filters-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          marginBottom: 13,
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontWeight: 500 }}>Filters:</label>
        {scanMode === "quick" && (
          <>
            <Tooltip tip="Filter by vulnerability severity">
              <select
                className="hx-recon-input"
                style={{ width: 118, minWidth: 90 }}
                value={filters.severity}
                onChange={e =>
                  setFilters((f) => ({ ...f, severity: e.target.value }))
                }
                disabled={isScanning}
                aria-label="Severity"
              >
                <option value="">Severity (all)</option>
                {SEVERITIES.map((sev) => (
                  <option value={sev} key={sev}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</option>
                ))}
              </select>
            </Tooltip>
            <Tooltip tip="Filter by attack or issue category">
              <select
                className="hx-recon-input"
                style={{ width: 130, minWidth: 100 }}
                value={filters.category}
                onChange={e =>
                  setFilters((f) => ({ ...f, category: e.target.value }))
                }
                disabled={isScanning}
                aria-label="Category"
              >
                <option value="">Category (all)</option>
                {CATEGORIES.map((cat) => (
                  <option value={cat} key={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Tooltip>
            <Tooltip tip="Show only findings for this template file">
              <select
                className="hx-recon-input"
                style={{ width: 180, minWidth: 110 }}
                value={filters.template}
                onChange={e =>
                  setFilters((f) => ({ ...f, template: e.target.value }))
                }
                disabled={isScanning}
                aria-label="Template"
              >
                <option value="">Template (any)</option>
                {TEMPLATES.map((tpl) => (
                  <option value={tpl} key={tpl}>
                    {tpl}
                  </option>
                ))}
              </select>
            </Tooltip>
          </>
        )}
        {scanMode === "advanced" && (
          <Tooltip tip="For advanced users: Specify custom Nuclei YAML template and payloads. (Not wired yet)">
            <span style={{
              color: "#fef2c0",
              fontWeight: 600,
              fontSize: "1.04em",
              // placeholder box
              background: "#221d21",
              padding: "5px 18px",
              borderRadius: 8,
              border: "1.2px dashed #764b7b",
              marginLeft: 12,
            }}>
              Advanced: Custom template/payload editor (coming soon)
            </span>
          </Tooltip>
        )}
        {/* Global quick filter */}
        <Tooltip tip="Filter table – by name, endpoint, evidence, etc">
          <input
            type="search"
            className="hx-recon-input"
            placeholder="Quick filter…"
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            style={{
              minWidth: 110,
              maxWidth: 170,
              fontSize: "0.99em",
            }}
            aria-label="Table filter"
            disabled={isScanning}
          />
        </Tooltip>
        {/* Clear filters/selectors button */}
        <button
          type="button"
          className="hx-recon-btn"
          style={{
            marginLeft: 7,
            color: "#ecd",
            background: "#24243b",
            border: "1.1px solid #44446b",
            borderRadius: 6,
            padding: "7px 13px",
            fontSize: "0.96em",
            opacity: 0.7,
          }}
          title="Clear all filters"
          aria-label="Clear filters"
          onClick={() => {
            setFilters({ severity: "", category: "", template: "" });
            setTableFilter("");
            clearSelection();
          }}
        >
          Clear
        </button>
      </div>

      {/* Status & Progress */}
      <div
        className="hx-recon-status-row"
        style={{ minHeight: 30, marginTop: -6, marginBottom: 10, gap: 13 }}
      >
        {scanStatus === "idle" && (
          <span
            className="hx-recon-status-badge idle"
            style={{ background: "#232347", color: "#b6b7ce" }}
          >
            Idle
          </span>
        )}
        {scanStatus === "scanning" ? (
          <>
            <span
              className="hx-recon-status-badge"
              style={{ background: "#8256a2", color: "#ffe" }}
            >
              Scanning...
            </span>
            <span
              className="hx-recon-spinner"
              style={{
                display: "inline-block",
                marginLeft: 8,
                width: 17,
                height: 17,
                border: "3px solid #8b68d6",
                borderTop: "3px solid var(--accent)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <span
              style={{
                color: "#bcfbe9",
                marginLeft: 11,
                fontSize: "0.95em",
                fontFamily: "monospace",
                opacity: 0.82,
              }}
            >{progress}</span>
            <style>
              {"@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}"}
            </style>
          </>
        ) : null}
        {scanStatus === "finished" && (
          <span
            className="hx-recon-status-badge"
            style={{ background: "#144d3b", color: "#c6fff5" }}
          >
            Scan Complete
          </span>
        )}
        {error && (
          <span
            style={{
              color: "#eb7e96",
              marginLeft: 14,
              fontWeight: 500,
              fontSize: "1.04em",
            }}
          >
            {error}
          </span>
        )}
      </div>

      {/* Main Results Table */}
      <div
        className="hx-vuln-results-table-wrap"
        style={{
          overflowX: "auto",
          background: "#19192d",
          borderRadius: 8,
          border: "1.5px solid var(--tab-border)",
          marginBottom: 13,
          minHeight: 160,
          marginTop: 3,
          boxShadow: "0 1px 4px 0 #25223250",
        }}
      >
        <table className="hx-recon-table" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {/* Selection header */}
              <th style={{ width: 22 }}>
                {filteredFindings.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allRowsSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={e =>
                      e.target.checked
                        ? selectAllRows(filteredFindings)
                        : clearSelection()
                    }
                    aria-label="Select all"
                    tabIndex={0}
                  />
                )}
              </th>
              {VULN_COLUMNS.slice(1).map((col, idx) => (
                <th
                  key={col.field}
                  onClick={() =>
                    col.field && col.field !== "__poc"
                      ? setSortBy((sb) =>
                          sb === col.field
                            ? (setSortDir((d) => (d === "asc" ? "desc" : "asc")), col.field)
                            : (setSortDir("asc"), col.field)
                        )
                      : undefined
                  }
                  style={{
                    cursor: col.field !== "__poc" ? "pointer" : "default",
                    userSelect: "none",
                    color: sortBy === col.field
                      ? "var(--accent)"
                      : "#ffa1b0a8",
                    width: col.width,
                  }}
                  aria-sort={
                    sortBy === col.field
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.label}
                  {sortBy === col.field
                    ? sortDir === "asc"
                      ? " ▲"
                      : " ▼"
                    : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={VULN_COLUMNS.length} style={{ textAlign: "center", opacity: 0.5 }}>
                  {scanStatus === "scanning"
                    ? "Scanning for vulnerabilities..."
                    : "No findings (results will appear here)."}
                </td>
              </tr>
            ) : (
              filteredFindings.map((row, idx) => (
                <tr key={row.key || row.id || idx} style={{ borderBottom: "1px solid #24244e" }}>
                  {/* Select box */}
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selection[row.id || row.key]}
                      onChange={() => toggleSelectRow(row.id || row.key)}
                      aria-label="Select finding"
                      tabIndex={0}
                    />
                  </td>
                  <td style={{ color: "#fffee4", fontWeight: 500 }}>{row.__num}</td>
                  <td>
                    <SeverityBadge severity={row.severity} />
                  </td>
                  <td>
                    <TemplateChip template={row.template} />
                  </td>
                  <td>
                    <CategoryBadge category={row.category} />
                  </td>
                  <td style={{ maxWidth: 230, color: "#ffe99e", fontWeight: 500 }}>
                    <span title={row.name}>{(row.name || "").slice(0, 44)}</span>
                  </td>
                  <td style={{ fontFamily: "monospace", color: "#a2ebff", fontSize: "0.97em" }}>
                    <span title={row.target}>{(row.target || "").slice(0, 44)}</span>
                  </td>
                  <td style={{ fontSize: "0.93em", color: "#caabb5" }}>
                    <span title={row.evidence}>
                      {row.evidence && row.evidence.length > 34
                        ? row.evidence.slice(0, 34) + "…"
                        : row.evidence || ""}
                    </span>
                  </td>
                  <td>
                    <PoCBtn
                      onClick={() => setShowPoCIdx(idx)}
                      tooltip="Show PoC (various formats)"
                    />
                    {showPoCIdx === idx && (
                      <PoCModal
                        finding={row}
                        open={true}
                        onClose={() => setShowPoCIdx(null)}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tip/Guidance Panel */}
      <div
        className="hx-recon-tip"
        tabIndex={0}
        style={{ marginTop: 9, fontWeight: 500 }}
      >
        Tip: Select findings and use Export or Report. Click PoC for ready-to-run exploit samples (curl, Python requests, HTTPie). Filters update the table live.
      </div>
    </section>
  );
}
