import React, { createContext, useContext, useState, useMemo } from "react";
// Custom CSS for Bounty Aggregator (inlined for now; can separate if grows)
const SIDEBAR_WIDTH = 280;

// Sample placeholder bug bounty program data
const demoPrograms = [
  {
    id: "bbp-1",
    name: "Acme Corp",
    platform: "HackerOne",
    maxBounty: 5000,
    minBounty: 100,
    scopeTypes: ["web", "api"],
    isPublic: true,
    url: "https://hackerone.com/acme",
    description: "Acme Corp offers bounties for web, API bugs. US-based retailer. Multiple domains in scope.",
    logo: "https://logo.clearbit.com/acme.com",
  },
  {
    id: "bbp-2",
    name: "Globex Mobile",
    platform: "Bugcrowd",
    maxBounty: 20000,
    minBounty: 500,
    scopeTypes: ["mobile", "api"],
    isPublic: true,
    url: "https://bugcrowd.com/globex",
    description: "Globex pays top bounties for mobile and API vulnerabilities. Mobile apps (iOS/Android) in scope.",
    logo: "https://logo.clearbit.com/globex.com",
  },
  {
    id: "bbp-3",
    name: "Wayne Enterprises",
    platform: "HackerOne",
    maxBounty: 1500,
    minBounty: 0,
    scopeTypes: ["web"],
    isPublic: false,
    url: "https://hackerone.com/wayne",
    description: "Private program for invited researchers. Web only. Bounty payment may require NDA.",
    logo: "https://logo.clearbit.com/wayneenterprises.com",
  },
];

// ----------------------
// Context definition
// ----------------------
const BountyAggregatorContext = createContext();

// PUBLIC_INTERFACE
export function useBountyAggregator() {
  return useContext(BountyAggregatorContext);
}

// Provider wrapper for state/future backend
// PUBLIC_INTERFACE
export function BountyAggregatorProvider({ children }) {
  // In production, hook to API/cache flow with useEffect, here simple placeholders
  const [filter, setFilter] = useState({
    min: 0,
    max: 20000,
    scopeTypes: {
      web: true,
      mobile: true,
      api: true,
    },
    search: "",
  });

  // Placeholder - for integrating with recon module cache
  const saveToRecon = (program) => {
    alert("Saved to Recon (stub):\n\n" + program.name);
  };

  // Filter programs by sidebar UI state
  const filteredPrograms = useMemo(() => {
    return demoPrograms.filter((p) => {
      const { min, max, scopeTypes, search } = filter;
      if (p.maxBounty < min || (max && p.minBounty > max)) return false;
      const typeMatches = p.scopeTypes.some((t) => scopeTypes[t]);
      if (!typeMatches) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.description.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [filter]);

  // Context value
  const value = { filter, setFilter, filteredPrograms, saveToRecon };
  return (
    <BountyAggregatorContext.Provider value={value}>
      {children}
    </BountyAggregatorContext.Provider>
  );
}

// ----------------------
// Sidebar filter controls
// ----------------------
function BountySidebar() {
  const { filter, setFilter } = useBountyAggregator();
  const scopeTypes = filter.scopeTypes;

  // Update helpers
  const handleBountyChange = (type, val) => {
    setFilter((f) => ({ ...f, [type]: Number(val) }));
  };

  const handleScopeChange = (scope) => {
    setFilter((f) => ({
      ...f,
      scopeTypes: { ...f.scopeTypes, [scope]: !f.scopeTypes[scope] },
    }));
  };

  const handleSearchChange = (e) => {
    setFilter((f) => ({ ...f, search: e.target.value }));
  };

  return (
    <aside
      className="bbag-sidebar"
      style={{
        flex: `0 0 ${SIDEBAR_WIDTH}px`,
        minWidth: SIDEBAR_WIDTH,
        maxWidth: SIDEBAR_WIDTH,
        background: "var(--panel-bg)",
        borderRight: "2px solid var(--tab-border)",
        padding: "32px 21px 22px 28px",
        color: "var(--on-primary)",
        display: "flex",
        flexDirection: "column",
        gap: 26,
        fontSize: 16,
        fontFamily: "inherit",
        height: "100%",
        boxShadow: "4px 0 18px 0 #0a0b136f"
      }}
      aria-label="Program Filters"
    >
      <div>
        <div
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: "1.18em",
            letterSpacing: "0.02em",
            marginBottom: 8,
            display: "flex",
            gap: 11,
            alignItems: "center"
          }}
        >
          <span role="img" aria-label="filters">
            🧰
          </span>
          Program Filters
        </div>
        <div
          style={{
            color: "#d6ddfc",
            fontSize: 13.5,
            opacity: 0.85,
            marginBottom: 12,
          }}
        >
          Narrow program list by scope, bounty, or keyword.
        </div>
      </div>
      {/* Bounty Range */}
      <div>
        <label htmlFor="bounty-min" style={{ fontWeight: 500 }}>
          Bounty Min ($)
        </label>
        <input
          id="bounty-min"
          type="number"
          min={0}
          max={filter.max}
          value={filter.min}
          onChange={(e) => handleBountyChange("min", e.target.value)}
          style={inputStyle}
          aria-label="Minimum Bounty"
        />
        <label htmlFor="bounty-max" style={{ fontWeight: 500, marginTop: 7 }}>
          Max ($)
        </label>
        <input
          id="bounty-max"
          type="number"
          min={filter.min}
          max={50000}
          value={filter.max}
          onChange={(e) => handleBountyChange("max", e.target.value)}
          style={inputStyle}
          aria-label="Maximum Bounty"
        />
        <input
          type="range"
          min={0}
          max={50000}
          step={100}
          value={filter.min}
          onChange={(e) => handleBountyChange("min", e.target.value)}
          style={sliderStyle}
          aria-label="Bounty minimum slider"
        />
        <input
          type="range"
          min={0}
          max={50000}
          step={100}
          value={filter.max}
          onChange={(e) => handleBountyChange("max", e.target.value)}
          style={{ ...sliderStyle, marginTop: 6 }}
          aria-label="Bounty maximum slider"
        />
      </div>
      {/* Scope toggles */}
      <div>
        <div style={{ fontWeight: 500, marginBottom: 5 }}>Scope Type</div>
        <div style={scopeRowStyle}>
          <ScopeToggle
            scope="web"
            label="Web"
            checked={scopeTypes.web}
            onChange={() => handleScopeChange("web")}
            color="#ffe38d"
          />
          <ScopeToggle
            scope="mobile"
            label="Mobile"
            checked={scopeTypes.mobile}
            onChange={() => handleScopeChange("mobile")}
            color="#99e0fd"
          />
          <ScopeToggle
            scope="api"
            label="API"
            checked={scopeTypes.api}
            onChange={() => handleScopeChange("api")}
            color="#fbaaaa"
          />
        </div>
      </div>
      {/* Search control */}
      <div style={{ marginTop: 4 }}>
        <label htmlFor="search-prog" style={{ fontWeight: 500 }}>
          Search
        </label>
        <input
          id="search-prog"
          type="search"
          value={filter.search}
          onChange={handleSearchChange}
          placeholder="Program name, keyword..."
          style={inputStyle}
          aria-label="Search programs"
        />
      </div>
      <div style={{ flex: 1 }} />
      <div
        aria-hidden="true"
        style={{
          color: "#bbb",
          fontSize: 12,
          textAlign: "right",
          marginTop: 24,
          opacity: 0.49,
          letterSpacing: "0.03em",
          fontStyle: "italic",
        }}
      >
        Burp Suite-inspired UI
      </div>
    </aside>
  );
}

function ScopeToggle({ scope, label, checked, onChange, color }) {
  // Accessible custom toggle
  return (
    <label
      htmlFor={`toggle-${scope}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        borderRadius: 20,
        padding: "6px 12px",
        cursor: "pointer",
        background: checked ? "#2d2d3b" : "transparent",
        color: checked ? color : "#c1c0fd",
        fontWeight: "bold",
        fontSize: 15.5,
        border: checked ? `1.4px solid ${color}` : "1.3px solid #39396e",
        transition: "background .13s, border .12s",
      }}
      tabIndex={0}
      aria-label={`Toggle scope ${label}`}
    >
      <input
        id={`toggle-${scope}`}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{
          accentColor: color,
          marginRight: 3,
          width: 20,
          height: 20,
        }}
        aria-checked={checked}
      />{" "}
      {label}
    </label>
  );
}

const inputStyle = {
  borderRadius: 7,
  padding: "7px 14px",
  fontSize: 16,
  color: "#fffad9",
  background: "#18192c",
  border: "1.7px solid var(--tab-border)",
  marginTop: 4,
  marginBottom: 5,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const sliderStyle = {
  width: "100%",
  marginTop: 8,
  accentColor: "var(--accent)",
};

const scopeRowStyle = {
  display: "flex",
  gap: 9,
  marginTop: 5,
  flexWrap: "wrap",
};

// -----------------------
// Main card list area
// -----------------------
function BountyResultsArea() {
  const { filteredPrograms, saveToRecon } = useBountyAggregator();

  return (
    <section
      className="bbag-main-results"
      style={{
        flex: 1,
        padding: "23px 30px 18px 30px",
        display: "flex",
        flexDirection: "column",
        gap: 21,
        minWidth: 0,
        minHeight: 350,
      }}
      aria-label="Bug Bounty Programs"
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: "1.33em",
          color: "var(--accent)",
          marginBottom: 7,
          letterSpacing: "0.01em"
        }}
      >
        <span role="img" aria-label="bounty-hunter" style={{marginRight:10}}>🎯</span>
        Bug Bounty Program Aggregator
      </div>
      <div
        style={{
          color: "#d6e5fc",
          fontWeight: 400,
          fontSize: 15,
          opacity: 0.86,
          marginBottom: 5,
          maxWidth: 650,
        }}
      >
        View, filter, and save bug bounty program scopes for Recon. Supports web, API, and mobile bounty targets.
      </div>
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: filteredPrograms.length ? "stretch" : "center",
          marginTop: 9,
        }}
        aria-live="polite"
      >
        {filteredPrograms.length === 0 ? (
          <div
            style={{
              color: "#fdc",
              fontWeight: 500,
              fontSize: 18,
              opacity: 0.7,
              marginTop: 23,
              marginLeft: 6
            }}
            aria-live="polite"
          >
            No programs match filters.
          </div>
        ) : (
          filteredPrograms.map((program, idx) => (
            <BountyProgramCard
              key={program.id}
              program={program}
              onSave={() => saveToRecon(program)}
            />
          ))
        )}
      </div>
      <div
        style={{
          color: "#9bc",
          fontSize: 13,
          marginTop: 41,
          borderRadius: 6,
          background: "#171728",
          padding: "11.5px 19px",
          opacity: 0.81,
          fontStyle: "italic",
          maxWidth: 420,
        }}
      >
        Tip: Programs saved to Recon will appear in the dashboard for scope enforcement and targeting.
      </div>
    </section>
  );
}

function BountyProgramCard({ program, onSave }) {
  // Card display: logo, program name, badge, bounties, scope chips, etc.
  const { name, platform, maxBounty, minBounty, url, description, logo, scopeTypes, isPublic } =
    program;

  return (
    <div
      className="bbag-program-card"
      tabIndex={0}
      style={{
        background: "#21233a",
        border: "2px solid var(--tab-border)",
        borderRadius: 11,
        minWidth: 320,
        maxWidth: 388,
        minHeight: 176,
        color: "#fff",
        fontSize: 15.2,
        boxShadow: "0 2px 17px 0 #1616315e",
        padding: "20px 28px 22px 23px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        position: "relative",
        outline: "none",
      }}
      aria-label={name}
      aria-describedby={`bbag-desc-${program.id}`}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 3 }}>
        <img
          src={logo}
          alt={`${name} logo`}
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#1A1A2E",
            objectFit: "cover",
            border: "2.2px solid #32325a",
            marginRight: 2,
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 19 }}>{name}</span>
        <span
          style={{
            background: platform === "HackerOne" ? "#371c26" : "#142444",
            color: platform === "HackerOne" ? "#e94560" : "#97f0f0",
            border: "1.1px solid #313362",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            padding: "4px 13px",
            marginLeft: 6,
          }}
          aria-label="Platform"
        >
          {platform}
        </span>
        {!isPublic && (
          <span style={{ marginLeft: 8, fontSize: 12.5, background: "#3a3166", color: "#e8acfb", borderRadius: 7, padding: "2px 9px", fontWeight: 400 }}>
            Private
          </span>
        )}
      </div>
      <div style={{ color: "#ffa1c9", fontSize: 13.5, fontWeight: 500, marginBottom: 2 }}>
        <span>
          ${minBounty}-{maxBounty} bounty{" "}
        </span>
        <span
          style={{
            background: "#1d2645",
            color: "#f7d97c",
            borderRadius: 5,
            fontWeight: 500,
            fontSize: 13,
            padding: "1.6px 12px",
            marginLeft: 8,
            marginRight: 3,
          }}
        >
          In Scope:
        </span>
        {scopeTypes.map((type) => (
          <span
            key={type}
            style={{
              padding: "3px 11px",
              borderRadius: 8,
              marginRight: 8,
              fontSize: 13,
              fontWeight: 600,
              background:
                type === "web"
                  ? "#ffe78d44"
                  : type === "mobile"
                  ? "#a1e8ff45"
                  : "#fbc6ba3a",
              color:
                type === "web"
                  ? "#ffe78d"
                  : type === "mobile"
                  ? "#60e1ff"
                  : "#ffbab6",
              border:
                type === "web"
                  ? "1.1px solid #ffe46b"
                  : type === "mobile"
                  ? "1px solid #20caf3"
                  : "1px solid #fa778e",
            }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>
      <div id={`bbag-desc-${program.id}`} style={{ color: "#ddd", fontSize: 15, marginBottom: 3 }}>
        {description}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 3 }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "underline",
            color: "#8defff",
            fontWeight: 500,
            fontSize: 14.5,
            marginRight: 10,
          }}
          aria-label={`Open bounty program for ${name} on ${platform}`}
        >
          View Program
        </a>
        <button
          className="bbag-save-recon-btn"
          style={saveBtnStyle}
          onClick={onSave}
          aria-label={`Save ${name} to Recon`}
        >
          + Save to Recon
        </button>
      </div>
    </div>
  );
}

const saveBtnStyle = {
  background: "var(--accent)",
  color: "#fff",
  borderRadius: 7,
  border: "none",
  fontWeight: 700,
  fontSize: 15,
  padding: "6px 18px",
  marginLeft: 2,
  cursor: "pointer",
  outline: "none",
  boxShadow: "0 1px 7px 0 #e9456029",
  transition: "background .13s",
};

// ----------------------
// Main Aggregator Component
// ----------------------
// PUBLIC_INTERFACE
export default function BountyAggregator() {
  return (
    <div
      className="bbag-aggregator-root"
      style={{
        display: "flex",
        flexDirection: "row",
        minHeight: 440,
        background: "var(--panel-bg)",
        borderRadius: "var(--border-radius)",
        boxShadow: "0 2.5px 20px 0 #231a2855",
        marginTop: 12,
        fontFamily: "inherit"
      }}
      tabIndex={0}
      aria-label="Bug Bounty Aggregator"
      role="region"
    >
      <BountySidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <BountyResultsArea />
      </div>
    </div>
  );
}

