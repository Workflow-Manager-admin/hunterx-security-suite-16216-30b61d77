import React from "react";

/**
 * Simple asset graph visualization for Recon results.
 * Renders subdomains/assets as nodes (circles) and edges to the root/parent domain.
 * Live, responsive, color-blind accessible. No external dependency required.
 * Props:
 *   - results: [{ domain, ip, assetType, ... }]
 *   - rootDomain: string (optional, default inferred from results)
 */
function getRootDomain(results) {
  for (let row of results) {
    if (row.domain) {
      // Grab last 2 parts for base domain.
      let parts = row.domain.split(".");
      if (parts.length > 1) return parts.slice(-2).join(".");
    }
    if (row.asset) {
      let parts = row.asset.split(".");
      if (parts.length > 1) return parts.slice(-2).join(".");
    }
  }
  return "domain";
}

// PUBLIC_INTERFACE
export default function ReconGraph({ results, rootDomain }) {
  // Deduplicate assets (by domain/ip/asset)
  const items = [];
  const keySet = new Set();
  for (let row of results) {
    let k = row.domain || row.asset || row.ip || "";
    if (k && !keySet.has(k)) {
      items.push(row);
      keySet.add(k);
    }
  }
  if (items.length === 0) {
    return (
      <svg width="220" height="140" style={{ minWidth: 120, minHeight: 60 }}>
        <text x={30} y={70} fill="#bbbb" fontSize="16">No data</text>
      </svg>
    );
  }

  const root = rootDomain || getRootDomain(items);
  // Place nodes in a radial/circular layout
  const centerX = 130, centerY = 80;
  const r = 46 + 10 * Math.min(5, items.length);

  // Accessibility: use patterns and high-contrast fill for types.
  function nodeColor(type, idx) {
    if (!type) return "#f3f6fb";
    if (type === "subdomain" || type === "domain") return "#ffe38d";
    if (type === "ip" || type === "host") return "#63d0e3";
    if (type === "service" || type === "port") return "#e94560";
    return ["#feda7a", "#3ee", "#e94560", "#30e05f", "#c6aaff"][idx % 5];
  }

  // Root node always at center, assets in a ring
  return (
    <svg
      width="98%"
      height="190"
      style={{ minWidth: 200 }}
      aria-label="Asset graph visualization"
      role="img"
    >
      <circle cx={centerX} cy={centerY} r={30} fill="#2e2e54" stroke="#e94560" strokeWidth="2.5" />
      <text x={centerX} y={centerY + 7} fontSize="15" fill="#ffeeb0" textAnchor="middle" fontWeight="bold">{root}</text>
      {items.map((row, i) => {
        const angle = (2 * Math.PI * i) / items.length;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        // Draw line from center to node
        return (
          <g key={i}>
            <line x1={centerX} y1={centerY} x2={x} y2={y} stroke="#565283" strokeWidth="1.4" />
            <circle
              cx={x}
              cy={y}
              r={13}
              fill={nodeColor(row.assetType || row.type, i)}
              stroke="#282848"
              strokeWidth="1.3"
              tabIndex={0}
            />
            <text x={x} y={y + 27} textAnchor="middle" fontSize="11" fill="#bbb">
              {(row.domain || row.asset || row.ip || "—").slice(0, 18)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
