import React, { useMemo } from "react";
import { useNucleiScan } from "../context/NucleiScannerContext";
import { exportCSV, exportJSON } from "./ExportUtils";

// Severities for Nuclei (color, label)
const SEVERITY_COLORS = {
  critical: "#e94560",
  high: "#fb8500",
  medium: "#fbce21",
  low: "#56cfe1",
  info: "#cdcbff",
};

/**
 * PUBLIC_INTERFACE
 * VulnScanner: expects to be used within NucleiScannerProvider (which provides useNucleiScan state).
 */
export default function VulnScanner({}) {
  // Use NucleiScannerContext for all scan state & actions
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
  } = useNucleiScan();

  // Local (UI-only) state for table filtering/sorting
  const [tableFilter, setTableFilter] = React.useState("");
  const [sortBy, setSortBy] = React.useState("severity");
  const [sortDir, setSortDir] = React.useState("desc");

  // Placeholder template/category filter lists
  const SEVERITIES = ["critical", "high", "medium", "low", "info"];
  const CATEGORIES = [
    "XSS",
    "SQLi",
    "RCE",
    "LFI",
    "Auth",
    "CVE",
    "SSRF",
    "Open-Redirect",
    "Other",
  ];
  const TEMPLATES = [
    "cves/2023/CVE-2023-1234.yaml",
    "fuzzing/xss-reflected.yaml",
    "misc/open-redirect.yaml",
    "misc/jwt-none-bypass.yaml",
  ];

  // === Scan Actions ===
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
  function handleExportCSV() {
    exportCSV(filteredFindings, VULN_COLUMNS, "vulnscan-results.csv");
  }
  function handleExportJSON() {
    exportJSON(filteredFindings, "vulnscan-results.json");
  }

  // Table columns
  const VULN_COLUMNS = [
    { label: "#", field: "__num" },
    { label: "Severity", field: "severity" },
    { label: "Template", field: "template" },
    { label: "Category", field: "category" },
    { label: "Vulnerability", field: "name" },
    { label: "Endpoint", field: "target" },
    { label: "Evidence", field: "evidence" },
  ];

  // Process findings for table (add row number)
  const numberedFindings = useMemo(
    () =>
      (Array.isArray(findings) ? findings : []).map((f, idx) => ({
        ...f,
        __num: idx + 1,
      })),
    [findings]
  );
  // Filtering and sorting
  const filteredFindings = useMemo(() => {
    let data = numberedFindings;
    // Table quick filter
    if (tableFilter) {
      const f = tableFilter.toLowerCase();
      data = data.filter((row) =>
        Object.values(row)
          .join(" ")
          .toLowerCase()
          .includes(f)
      );
    }
    // Side filters
    if (filters.severity)
      data = data.filter((row) => row.severity === filters.severity);
    if (filters.category)
      data = data.filter((row) => row.category === filters.category);
    if (filters.template)
      data = data.filter((row) => row.template === filters.template);
    // Sorting
    if (sortBy) {
      data = [...data].sort((a, b) => {
        if (a[sortBy] == null) return 1;
        if (b[sortBy] == null) return -1;
        if (sortBy === "severity") {
          // Sort by severity order above
          return (
            SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
          );
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

  // === Render ===

  return (
    <section className="hx-module-panel hx-vuln-panel" data-module="scanner">
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span role="img" aria-label="bolt" style={{ fontSize: 28 }}>
          ⚡
        </span>
        Vulnerability Scanner
      </h2>
      <p style={{ color: "#d7dfff", marginBottom: 8, fontSize: "1.09em" }}>
        Automated Nuclei scan UI: scan endpoints, filter by template/category, and review findings.{" "}
        <span style={{ color: "var(--accent)", fontWeight: 500 }}>Burp Suite-inspired workflow</span>.
      </p>

      {/* Input Row: Scan Target + Mode + Actions */}
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
        {/* Mode dropdown */}
        <select
          className="hx-recon-input"
          style={{
            width: 120,
            fontWeight: 500,
            color: "#f4f6ffd9",
            paddingLeft: 10,
            background: "#232344",
            border: "2px solid var(--tab-border)",
            minWidth: 120,
          }}
          value={scanMode}
          onChange={e => handleModeChange(e.target.value)}
          disabled={isScanning}
          aria-label="Scan mode"
        >
          <option value="quick">Quick</option>
          <option value="advanced">Advanced</option>
        </select>
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
          >
            Cancel
          </button>
        ) : null}
        {/* Export buttons */}
        <span style={{ marginLeft: 12, display: "flex", gap: 6 }}>
          <button
            className="hx-recon-btn"
            style={{
              background: "var(--panel-bg)",
              border: "1.2px solid var(--accent)",
              color: "var(--accent)",
              fontWeight: 500,
              padding: "7px 12px",
              fontSize: "1em",
              borderRadius: 5,
              opacity: filteredFindings.length > 0 ? 1 : 0.5,
              cursor: filteredFindings.length > 0 ? "pointer" : "not-allowed",
            }}
            title="Export findings as CSV"
            disabled={filteredFindings.length === 0}
            onClick={handleExportCSV}
          >
            CSV
          </button>
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
            onClick={handleExportJSON}
          >
            JSON
          </button>
        </span>
        <span style={{ marginLeft: 15 }}>
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
            }}
            title="Generate Report (PDF)"
            disabled={filteredFindings.length === 0}
          >
            Report
          </button>
        </span>
      </div>

      {/* Filters Panel */}
      <div
        className="hx-vuln-filters-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          marginBottom: 15,
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontWeight: 500 }}>Filters:</label>
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
            <option value={sev} key={sev}>
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </option>
          ))}
        </select>
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
        {/* Table filter */}
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
            marginLeft: 6,
          }}
          aria-label="Table filter"
          disabled={isScanning}
        />
      </div>

      {/* Status and Progress */}
      <div
        className="hx-recon-status-row"
        style={{ minHeight: 30, marginTop: -6, marginBottom: 10, gap: 13 }}
      >
        {scanStatus === "idle" ? (
          <span
            className="hx-recon-status-badge idle"
            style={{ background: "#232347", color: "#b6b7ce" }}
          >
            Idle
          </span>
        ) : null}
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
            <style>
              {
                "@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}"
              }
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

      {/* Main Table */}
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
        <table className="hx-recon-table">
          <thead>
            <tr>
              {VULN_COLUMNS.map((col) => (
                <th
                  key={col.field}
                  role="columnheader"
                  onClick={() =>
                    setSortBy((sb) =>
                      sb === col.field
                        ? (setSortDir((d) => (d === "asc" ? "desc" : "asc")), col.field)
                        : (setSortDir("asc"), col.field)
                    )
                  }
                  style={{
                    cursor: "pointer",
                    userSelect: "none",
                    color:
                      sortBy === col.field
                        ? "var(--accent)"
                        : "#ffa1b0a8",
                  }}
                  aria-sort={
                    sortBy === col.field
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  tabIndex={0}
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
                <tr key={row.key || row.id || idx}>
                  <td style={{ color: "#fffee4", fontWeight: 500 }}>{row.__num}</td>
                  <td>
                    <SeverityBadge severity={row.severity} />
                  </td>
                  <td style={{ fontSize: "0.98em", color: "#ccfdff" }}>
                    {row.template}
                  </td>
                  <td style={{ fontWeight: 500, color: "#8cf5c9" }}>{row.category}</td>
                  <td style={{ maxWidth: 260, color: "#ffe99e", fontWeight: 500 }}>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PoC section: shown for 1st/highest result if any */}
      {filteredFindings.length > 0 && (
        <div
          className="hx-vuln-poc-section"
          style={{
            marginBottom: 8,
            background: "#22223c",
            borderRadius: 7,
            padding: "12px 18px 14px 13px",
            border: "1.5px solid var(--tab-border)",
            color: "#e3e3ef",
            fontSize: "1.06em",
          }}
        >
          <b>Proof-of-Concept (auto-generated):</b>
          <br />
          <span style={{ color: "#b7ffcd", fontWeight: 500 }}>
            {filteredFindings[0].pocType
              ? filteredFindings[0].pocType.toUpperCase()
              : "CURL"}
          </span>
          <pre
            style={{
              background: "#17172f",
              color: "#fff9e5",
              borderRadius: 6,
              padding: "8px 13px",
              marginTop: 5,
              fontFamily: "monospace",
              fontSize: 14,
            }}
          >
            {filteredFindings[0].poc ||
              "# Results of the scan will present exploit PoC here.\n"}
          </pre>
        </div>
      )}

      {/* Guidance/Help */}
      <div
        className="hx-recon-tip"
        tabIndex={0}
        style={{ marginTop: 9, fontWeight: 500 }}
      >
        Tip: Enter a scan target and choose mode. Use filters to focus findings (e.g., show only XSS findings or critical CVEs).
      </div>
      {/* Placeholders for future integrations */}
      {/* TODO: Wire up Nuclei scan via Electron IPC (backend triggers, status, result streaming)
                - State/context via useNucleiScan
                - Template/category data from backend template manager
      */}
    </section>
  );
}

// Severity badge style
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

// === Placeholder/sample findings for dev/demo ===
const SAMPLE_FINDINGS = [
  {
    id: "1",
    severity: "high",
    template: "fuzzing/xss-reflected.yaml",
    category: "XSS",
    name: "Reflected XSS in /search parameter",
    target: "https://acme.test/search?q=%3Cimg%20src%3Dx:onerror=alert(1)%3E",
    evidence: "payload reflected in HTML",
    pocType: "curl",
    poc: `curl -X GET "https://acme.test/search?q=%3Cimg%20src%3Dx:onerror=alert(1)%3E" -H "User-Agent: nuclei"`,
  },
  {
    id: "2",
    severity: "medium",
    template: "cves/2023/CVE-2023-1234.yaml",
    category: "CVE",
    name: "CVE-2023-1234 - Open Redirect",
    target: "https://acme.test/redirect?url=http://evil.site",
    evidence: "Location header",
    pocType: "curl",
    poc: `curl -I "https://acme.test/redirect?url=http://evil.site"`,
  },
  {
    id: "3",
    severity: "critical",
    template: "misc/jwt-none-bypass.yaml",
    category: "Auth",
    name: "JWT None Algorithm Bypass",
    target: "https://acme.test/api/profile",
    evidence: "alg: none JWT accepted",
    pocType: "python-requests",
    poc: `import requests\njwt = "<header-payload-sig>"\nr = requests.get("https://acme.test/api/profile", headers={"Authorization": "Bearer "+jwt})\nprint(r.status_code)`,
  },
  {
    id: "4",
    severity: "low",
    template: "misc/open-redirect.yaml",
    category: "Open-Redirect",
    name: "Simple Open Redirect",
    target: "https://acme.test/redirect?goto=http://hacker.site",
    evidence: "redirect triggers",
    pocType: "curl",
    poc: `curl -I "https://acme.test/redirect?goto=http://hacker.site"`,
  },
  {
    id: "5",
    severity: "info",
    template: "misc/headers-xpoweredby.yaml",
    category: "Other",
    name: "Exposes X-Powered-By Header",
    target: "https://acme.test/",
    evidence: "Header: X-Powered-By: PHP/7.4",
    pocType: "curl",
    poc: `curl -I "https://acme.test/"`,
  },
];
