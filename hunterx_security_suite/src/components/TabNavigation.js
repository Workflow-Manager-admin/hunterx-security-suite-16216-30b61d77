import React from "react";
import "./TabNavigation.css";
import { useAppState, useAppDispatch } from "../context/AppContext";

const TABS = [
  { key: "recon", label: "Recon" },
  { key: "scanner", label: "Vuln Scanner" },
  { key: "exploit", label: "Exploit Toolkit" },
  { key: "report", label: "Reporting" },
  { key: "bounty", label: "Bounty Aggregator" },
  { key: "plugins", label: "Plugins/Settings" },
];

export default function TabNavigation() {
  const { activeTab } = useAppState();
  const dispatch = useAppDispatch();

  const handleTabClick = (tab) =>
    dispatch({ type: "SET_TAB", tab });

  return (
    <nav className="hx-tab-nav" aria-label="Module navigation">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`hx-tab${activeTab === tab.key ? " active" : ""}`}
          onClick={() => handleTabClick(tab.key)}
          aria-current={activeTab === tab.key ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
      <div className="hx-tab-indicator" style={{ "--hx-tab-active": TABS.findIndex(t => t.key === activeTab) }}></div>
    </nav>
  );
}
