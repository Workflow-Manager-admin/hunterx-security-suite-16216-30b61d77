import React from "react";
import "./App.css";
import "./styles/theme.css";
import TabNavigation from "./components/TabNavigation";
import { AppProvider, useAppState } from "./context/AppContext";

function ModulePanel() {
  const { activeTab } = useAppState();
  switch (activeTab) {
    case "recon":
      return (
        <section className="hx-module-panel" data-module="recon">
          <h2>Recon</h2>
          <p>Subdomain enumeration, port scan & visualization coming soon.</p>
        </section>
      );
    case "scanner":
      return (
        <section className="hx-module-panel" data-module="scanner">
          <h2>Vulnerability Scanner</h2>
          <p>Nuclei & Template Manager UI goes here.</p>
        </section>
      );
    case "exploit":
      return (
        <section className="hx-module-panel" data-module="exploit">
          <h2>Exploitation Toolkit</h2>
          <p>MITM proxy, JS Analyzer, and automation soon available.</p>
        </section>
      );
    case "report":
      return (
        <section className="hx-module-panel" data-module="report">
          <h2>Reporting Suite</h2>
          <p>Markdown/PDF export and report builder planned here.</p>
        </section>
      );
    case "bounty":
      return (
        <section className="hx-module-panel" data-module="bounty">
          <h2>Bounty Aggregator</h2>
          <p>Aggregated bug bounty program scopes, integrations (HackerOne/Bugcrowd)...</p>
        </section>
      );
    case "plugins":
      return (
        <section className="hx-module-panel" data-module="plugins">
          <h2>Plugins & Settings</h2>
          <p>Manage plugins, integrations, and suite settings here.</p>
        </section>
      );
    default:
      return null;
  }
}

function TopBar() {
  return (
    <header className="hx-topbar">
      <div className="hx-topbar-logo">
        <span style={{ color: "var(--accent)", fontWeight: 700, marginRight: 6, fontSize: "1.7rem" }}>⛨</span>
        <span className="hx-topbar-title">HunterX Security Suite</span>
      </div>
      <div className="hx-topbar-actions">
        <button className="hx-topbar-action" title="Settings" aria-label="Settings">
          <span role="img" aria-label="Settings">⚙️</span>
        </button>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="hx-app">
      <TopBar />
      <TabNavigation />
      <main className="hx-main-content">
        <ModulePanel />
      </main>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}