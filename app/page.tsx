"use client";

import { useState } from "react";
import { useHalda } from "@/lib/useHalda";
import AppBar from "@/components/app/AppBar";
import Dock from "@/components/app/Dock";
import AIGuideSheet from "@/components/app/AIGuideSheet";
import ProfileMenu from "@/components/app/ProfileMenu";
import HomeTab from "@/components/app/HomeTab";
import ExploreTab from "@/components/app/ExploreTab";
import ProfileTab from "@/components/app/ProfileTab";
import ConnectTab from "@/components/app/ConnectTab";
import type { Tab } from "@/components/app/helpers";

export default function App() {
  const { send } = useHalda();
  const [tab, setTab] = useState<Tab>("home");
  const [guideOpen, setGuideOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Open the AI guide, optionally sending a starter prompt straight to the agent.
  const onAsk = (text?: string) => {
    setGuideOpen(true);
    if (text) send(text, "web");
  };

  return (
    <div className="appwrap">
      <div className="phone">
        {tab !== "profile" && <AppBar onAvatar={() => setMenuOpen(true)} />}

        {tab === "home" && <HomeTab onAsk={onAsk} onGoExplore={() => setTab("explore")} />}
        {tab === "explore" && <ExploreTab onAsk={onAsk} />}
        {tab === "profile" && <ProfileTab onAvatar={() => setMenuOpen(true)} />}
        {tab === "connect" && <ConnectTab onAsk={onAsk} />}

        <Dock active={tab} onTab={setTab} onFab={() => setGuideOpen(true)} />
        <AIGuideSheet open={guideOpen} onClose={() => setGuideOpen(false)} />
        <ProfileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onViewProfile={() => setTab("profile")} />
      </div>
    </div>
  );
}
