import React, { createContext, useContext, useReducer, useMemo } from "react";

/**
 * Initial state for the Bug Bounty Aggregator context.
 */
const initialBountyState = {
  search: "",
  maxBounty: "",
  scopeType: "all", // "all" | "web" | "mobile" | "api"
  programs: [], // List of bounty programs (populated later)
  savedScopes: [],
};

/**
 * Reducer for the Bug Bounty Aggregator state.
 */
function bountyReducer(state, action) {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_MAX_BOUNTY":
      return { ...state, maxBounty: action.value };
    case "SET_SCOPE_TYPE":
      return { ...state, scopeType: action.value };
    case "SET_PROGRAMS":
      return { ...state, programs: action.value };
    case "SAVE_SCOPE":
      // Placeholder logic: in real integration, this will update SQLite/local cache.
      return { ...state, savedScopes: [...state.savedScopes, action.programId] };
    default:
      return state;
  }
}

// PUBLIC_INTERFACE
const BountyAggregatorContext = createContext();

/**
 * PUBLIC_INTERFACE
 * AggregatorProvider: Wrap parts of app to expose bounty aggregator context.
 */
export function BountyAggregatorProvider({ children }) {
  const [state, dispatch] = useReducer(bountyReducer, initialBountyState);
  const contextValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return (
    <BountyAggregatorContext.Provider value={contextValue}>
      {children}
    </BountyAggregatorContext.Provider>
  );
}

/**
 * PUBLIC_INTERFACE
 * Hook for accessing the aggregator state/actions.
 */
export function useBountyAggregator() {
  return useContext(BountyAggregatorContext);
}

// =======================
// UI Helper components
// =======================

/**
 * Sidebar filter/search controls for the aggregator.
 */
function AggregatorSidebar() {
  const { state, dispatch } = useBountyAggregator();
  return (
    <aside
      className="hx-bounty-sidebar"
      aria-label="Bug Bounty Filters"
      style={{
        minWidth: 230,
        maxWidth: 290,
        padding: "22px 18px 18px 8px",
        background: "var(--secondary)",
        borderRadius: "10px",
        border: "2px solid var(--tab-border)",
        marginRight: 32,
        height: "fit-content",
        color: "var(--on-primary)",
        boxShadow: "0 1.5px 12px 0 #160e2460",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div>
        <label htmlFor="aggregator-search" style={{ fontWeight: 600, color: "var(--accent)" }}>
          Program Search
        </label>
        <input
          id="aggregator-search"
          type="search"
          value={state.search}
          onChange={e => dispatch({ type: "SET_SEARCH", value: e.target.value })}
          placeholder="Search by name, domain, etc..."
          style={{
            width: "100%",
            padding: "8px 10px",
            marginTop: 6,
            borderRadius: 6,
            border: "1.5px solid var(--tab-border)",
            background: "#161622",
            color: "#fafaff"
          }}
          aria-label="Search programs"
        />
      </div>
      <div>
        <label htmlFor="max-bounty" style={{ fontWeight: 600, color: "var(--accent)" }}>Max Bounty ($)</label>
        <input
          id="max-bounty"
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          placeholder="No limit"
          aria-label="Maximum bounty filter"
          value={state.maxBounty}
          onChange={e => dispatch({ type: "SET_MAX_BOUNTY", value: e.target.value.replace(/\D/, "") })}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1.5px solid var(--tab-border)",
            background: "#161622",
            color: "#fafaff"
          }}
        />
      </div>
      <div>
        <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: 7 }}>
          Scope Type
        </div>
        <div role="group" aria-label="Scope type filter" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <label>
            <input
              type="radio"
              checked={state.scopeType === "all"}
              onChange={() => dispatch({ type: "SET_SCOPE_TYPE", value: "all" })}
              name="scope-type"
              style={{ marginRight: 9 }}
            />
            All
          </label>
          <label>
            <input
              type="radio"
              checked={state.scopeType === "web"}
              onChange={() => dispatch({ type: "SET_SCOPE_TYPE", value: "web" })}
              name="scope-type"
              style={{ marginRight: 9 }}
            />
            Web Apps
          </label>
          <label>
            <input
              type="radio"
              checked={state.scopeType === "mobile"}
              onChange={() => dispatch({ type: "SET_SCOPE_TYPE", value: "mobile" })}
              name="scope-type"
              style={{ marginRight: 9 }}
            />
            Mobile Apps
          </label>
          <label>
            <input
              type="radio"
              checked={state.scopeType === "api"}
              onChange={() => dispatch({ type: "SET_SCOPE_TYPE", value: "api" })}
              name="scope-type"
              style={{ marginRight: 9 }}
            />
            API/Backend
          </label>
        </div>
      </div>
      <div>
        <small style={{ color: "#ffeeb0", opacity: 0.76 }}>
          Filters update the grid below. More filter controls (platform, rewards, live/not) coming soon!
        </small>
      </div>
    </aside>
  );
}

/**
 * Renders program bounty cards in a grid layout.
 * The styling is Burp/Burp Suite-inspired: flat, high-contrast, readable.
 * @param programs List of bug bounty program objects
 */
function ProgramCardGrid({ programs, onSave, savedIds }) {
  if (programs.length === 0) {
    return (
      <div style={{ color: "#b1b1c9", fontSize: "1.23em", marginTop: 47, textAlign: "center", width: "100%" }}>
        <span style={{ fontSize: "2.3em", color: "#fde38d" }}>🪧</span>
        <br />
        No programs match your search/filter yet.
        <div style={{ fontSize: "0.96em", marginTop: 14, color: "#c3c3ed" }}>
          Try different keywords or filter settings.<br/>
          <span style={{ color: "#ff8580" }}>API integration is coming soon!</span>
        </div>
      </div>
    );
  }
  return (
    <section
      className="hx-bounty-card-grid"
      aria-label="Bounty program results"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(321px, 1fr))",
        gap: "24px",
        marginTop: 8
      }}
    >
      {programs.map((p, idx) =>
        <article
          key={p.id || p.name + idx}
          className="hx-bounty-card"
          tabIndex={0}
          style={{
            background: "var(--panel-bg)",
            border: "2px solid var(--tab-border)",
            borderRadius: "10px",
            padding: "18px 22px 21px 19px",
            boxShadow: "0 1px 8px 0 #1a1a2e88",
            color: "var(--on-primary)",
            fontSize: "1.04em",
            minHeight: 162,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative"
          }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 3 }}>
            <span
              style={{
                fontSize: "1.51em",
                marginRight: 2,
                color: "#fff8c9",
                filter: "drop-shadow(0 0 4px #18183899)"
              }}
              aria-label="Bounty program icon"
            >
              {p.platform === "HackerOne" ? "💰" : p.platform === "Bugcrowd" ? "🦞" : p.platform === "Intigriti" ? "🦾" : "🔎"}
            </span>
            <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: "1.18em" }}>{p.name}</span>
            <span
              style={{
                marginLeft: "auto",
                background: "#262845",
                color: "#ffeeb0",
                borderRadius: 8,
                fontSize: "0.96em",
                fontWeight: 700,
                padding: "2.5px 9px",
                border: "1.2px solid #ffeeb077"
              }}
            >
              {p.platform || "Unknown"}
            </span>
          </header>
          <div style={{ marginBottom: 7, lineHeight: 1.36, color: "#eaeaf3", fontWeight: 400 }}>
            <span style={{ color: "#b6fad8", fontFamily: "monospace", fontWeight: 600 }}>{p.target || p.domain || p.asset || "—"}</span>
            <br />
            <span style={{ fontSize: "0.95em", color: "#ffeeb0a3" }}>
              Scope: {String(p.scopeType || p.scope || "Not set")}
            </span>
          </div>
          <div style={{ fontSize: "1.13em", color: "#ffac94", marginBottom: 4 }}>
            Max Bounty: <b>${p.maxBounty ? Number(p.maxBounty).toLocaleString() : "?"}</b>
          </div>
          <footer style={{ marginTop: 9, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="hx-bounty-save-btn"
              onClick={() => onSave(p)}
              disabled={savedIds.includes(p.id)}
              aria-label="Save to Recon"
              style={{
                background: savedIds.includes(p.id) ? "#252544" : "var(--accent)",
                color: savedIds.includes(p.id) ? "#ccc" : "#fff",
                fontWeight: 600,
                border: "none",
                borderRadius: 6,
                padding: "6px 16px",
                marginRight: 8,
                fontSize: "1.01em",
                cursor: savedIds.includes(p.id) ? "not-allowed" : "pointer",
                opacity: savedIds.includes(p.id) ? 0.7 : 1,
                boxShadow: savedIds.includes(p.id) ? "none" : "0 0.5px 5px #43231330"
              }}
            >
              {savedIds.includes(p.id) ? "Saved" : "Save to Recon"}
            </button>
            <span style={{ fontSize: "0.96em", color: "#ffeeb0" }}>Triage</span>
            {/* Placeholder for actions */}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#6868a6" }}>
              {p.updatedAt ? "Updated: " + p.updatedAt : ""}
            </span>
          </footer>
        </article>
      )}
    </section>
  );
}

/**
 * Filter and prepare a mock list of programs for demonstration.
 * Future: Replace this with live API fetch and local cache logic.
 */
function useFilteredPrograms() {
  const { state } = useBountyAggregator();

  // Hardcoded sample programs (for UI populating in absence of backend)
  const samplePrograms = [
    { id: "h1-1", name: "Yahoo", platform: "HackerOne", maxBounty: 50000, target: "yahoo.com", scopeType: "web", updatedAt: "2024-04-10" },
    { id: "bc-1", name: "Tesla", platform: "Bugcrowd", maxBounty: 10000, target: "tesla.com", scopeType: "web", updatedAt: "2024-04-12" },
    { id: "int-1", name: "Booking.com", platform: "Intigriti", maxBounty: 25000, target: "booking.com", scopeType: "web", updatedAt: "2024-04-04" },
    { id: "h1-2", name: "Twitter", platform: "HackerOne", maxBounty: 4000, target: "twitter.com", scopeType: "api", updatedAt: "2024-04-08" },
    { id: "h1-3", name: "Dropbox Mobile", platform: "HackerOne", maxBounty: 6000, target: "api.dropbox.com", scopeType: "mobile", updatedAt: "2024-04-02" },
    { id: "bc-2", name: "Cloudflare", platform: "Bugcrowd", maxBounty: 3000, target: "cloudflare.com", scopeType: "web", updatedAt: "2024-03-28" },
    { id: "int-2", name: "PayPal APIs", platform: "Intigriti", maxBounty: 12000, target: "api.paypal.com", scopeType: "api", updatedAt: "2024-04-01" },
  ];
  // Later: override/state.programs after live API connect

  return useMemo(() => {
    let arr = samplePrograms;
    // Filter by search string
    if (state.search)
      arr = arr.filter(
        prog =>
          prog.name.toLowerCase().includes(state.search.toLowerCase()) ||
          String(prog.target || prog.domain || prog.asset).toLowerCase().includes(state.search.toLowerCase())
      );
    // Filter by max bounty
    if (state.maxBounty)
      arr = arr.filter(prog =>
        prog.maxBounty !== undefined && prog.maxBounty <= Number(state.maxBounty)
      );
    // Filter by scope type
    if (state.scopeType !== "all")
      arr = arr.filter(prog => String(prog.scopeType) === state.scopeType);
    return arr;
  }, [state.search, state.maxBounty, state.scopeType]);
}

// =============================
// Main Bug Bounty Aggregator UI
// =============================

/**
 * PUBLIC_INTERFACE
 * The entry point: Bug Bounty Aggregator component for the tab panel.
 * Usage: Place in panel for "Bounty Aggregator" tab.
 */
export default function BountyAggregator() {
  // Compose/consume context
  const { state, dispatch } = useBountyAggregator();
  const programs = useFilteredPrograms();

  // Save-to-recon handler (stub/placeholder for future backend/wireup)
  function handleSave(program) {
    // In real integration: Call Electron IPC or API to persist to SQLite/local cache
    dispatch({ type: "SAVE_SCOPE", programId: program.id });
    // Optionally show toast/notification
  }

  return (
    <section
      className="hx-module-panel hx-bounty-panel"
      data-module="bounty"
      style={{
        marginTop: 22,
        minHeight: 420,
        background: "var(--panel-bg)",
        boxShadow: "0 2px 20px 0 #18182a86",
        padding: "24px 24px 36px 24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "row",
        gap: 32,
        alignItems: "flex-start"
      }}
    >
      <AggregatorSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: "1.35em",
            margin: "0 0 3px 0",
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          <span role="img" aria-label="bug bounty" style={{ fontSize: "1.45em", marginRight: 6 }}>
            🪙
          </span>
          Bug Bounty Aggregator
        </h2>
        <p style={{ color: "#f2ecb0", margin: "2px 0 17px 0", fontSize: "1.09em" }}>
          Discover, filter, and triage programs from major bug bounty platforms.
          <span style={{ color: "#ffeeb0", fontWeight: 500, marginLeft: 11 }}>Burp Suite-inspired UI</span>.
        </p>
        <ProgramCardGrid
          programs={programs}
          onSave={handleSave}
          savedIds={state.savedScopes}
        />
        <div
          className="hx-bounty-tip"
          tabIndex={0}
          style={{
            marginTop: 17,
            background: "#22223d",
            borderLeft: "5.5px solid var(--accent)",
            borderRadius: 0,
            fontSize: "1.01em",
            padding: "13.5px 22px",
            opacity: 0.92,
            color: "#dfddea"
          }}
        >
          <b>Tip:</b> Select "Save to Recon" to import program targets for automated asset discovery.
          Platform syncing, scope change alerts, and offline caching coming soon.
        </div>
      </div>
    </section>
  );
}
