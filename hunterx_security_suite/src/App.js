import React from "react";
import "./App.css";
import "./styles/theme.css";
import TabNavigation from "./components/TabNavigation";
import { AppProvider, useAppState } from "./context/AppContext";

import ReconDashboard, { ReconProvider } from "./components/ReconDashboard";

function ModulePanel() {
  const { activeTab } = useAppState();
  switch (activeTab) {
    case "recon":
      return (
        <ReconProvider>
          <ReconDashboard />
        </ReconProvider>
      );
    case "scanner":
      // Lazy import to avoid circular import (if exists): safe for dev bundle
      const { NucleiScannerProvider } = require("./context/NucleiScannerContext");
      const VulnScanner = require("./components/VulnScanner").default;
      return (
        <NucleiScannerProvider>
          <VulnScanner />
        </NucleiScannerProvider>
      );
    case "exploit":
      // Use the new ExploitToolkit for the Exploitation tab panel
      const ExploitToolkit = require("./components/ExploitToolkit").default;
      return <ExploitToolkit />;
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