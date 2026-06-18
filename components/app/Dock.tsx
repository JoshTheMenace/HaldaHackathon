"use client";

import { Icon } from "./Icon";
import type { Tab } from "./helpers";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "home", label: "Home" },
  { id: "explore", icon: "explore", label: "Explore" },
  { id: "profile", icon: "person", label: "Profile" },
  { id: "cohort", icon: "groups", label: "Cohort" },
];

export default function Dock({ active, onTab, onFab }: { active: Tab; onTab: (t: Tab) => void; onFab: () => void }) {
  // Render two tabs, the FAB gap, then two tabs — matching the design layout.
  return (
    <nav className="dock">
      <div className="dock-inner">
        <div className="nav">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.id} t={t} active={active} onTab={onTab} />
          ))}
          <span className="gap" />
          {TABS.slice(2).map((t) => (
            <TabButton key={t.id} t={t} active={active} onTab={onTab} />
          ))}
          <button className="fab" aria-label="Ask your AI Guide" onClick={onFab}>
            <Icon name="mic" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function TabButton({ t, active, onTab }: { t: { id: Tab; icon: string; label: string }; active: Tab; onTab: (t: Tab) => void }) {
  return (
    <button className={`tab${active === t.id ? " on" : ""}`} onClick={() => onTab(t.id)}>
      <span className="ind" />
      <Icon name={t.icon} />
      {t.label}
    </button>
  );
}
