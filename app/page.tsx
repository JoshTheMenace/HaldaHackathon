"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { rankInterestMatches } from "@/lib/interest-match";
import AppBar from "@/components/app/AppBar";
import Dock from "@/components/app/Dock";
import AIGuideSheet from "@/components/app/AIGuideSheet";
import ProfileMenu from "@/components/app/ProfileMenu";
import SettingsSheet from "@/components/app/SettingsSheet";
import HomeTab from "@/components/app/HomeTab";
import ExploreTab from "@/components/app/ExploreTab";
import ProfileTab from "@/components/app/ProfileTab";
import ConnectTab from "@/components/app/ConnectTab";
import CohortTab from "@/components/app/CohortTab";
import { Icon } from "@/components/app/Icon";
import { matchSignature, type Tab } from "@/components/app/helpers";

export default function App() {
  const { send, profile, matchesRevealed } = useHalda();
  const [tab, setTab] = useState<Tab>("home");
  const [guideOpen, setGuideOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(false);

  // Open the AI guide, optionally sending a starter prompt straight to the agent.
  const onAsk = (text?: string) => {
    setGuideOpen(true);
    if (text) send(text, "web");
  };

  // Fire a "matches updated" toast when new info re-ranks the list.
  const sig = useMemo(() => (matchesRevealed ? matchSignature(rankInterestMatches(profile, 5)) : ""), [profile, matchesRevealed]);
  const prevSig = useRef(sig);
  useEffect(() => {
    if (matchesRevealed && prevSig.current && sig && sig !== prevSig.current) {
      setToast(true);
      const t = setTimeout(() => setToast(false), 2800);
      prevSig.current = sig;
      return () => clearTimeout(t);
    }
    prevSig.current = sig;
  }, [sig, matchesRevealed]);

  return (
    <div className="appwrap">
      <div className="phone">
        <AppBar onAvatar={() => setMenuOpen(true)} />

        {tab === "home" && <HomeTab onAsk={onAsk} onGoExplore={() => setTab("explore")} />}
        {tab === "explore" && <ExploreTab onAsk={onAsk} />}
        {tab === "profile" && <ProfileTab />}

        {tab === "connect" && <ConnectTab onAsk={onAsk} />}
        {tab === "cohort" && <CohortTab />}

        <div className={`toast${toast ? " on" : ""}`}><Icon name="auto_awesome" /> Your matches updated</div>

        <Dock active={tab} onTab={setTab} onFab={() => setGuideOpen(true)} />
        <AIGuideSheet open={guideOpen} onClose={() => setGuideOpen(false)} />
        <ProfileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onViewProfile={() => setTab("profile")} onConnect={() => setTab("connect")} onSettings={() => setSettingsOpen(true)} />
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </div>
  );
}
