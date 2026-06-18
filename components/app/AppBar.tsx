"use client";

import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import { initials } from "./helpers";

export default function AppBar({ onAvatar }: { onAvatar: () => void }) {
  const { profile } = useHalda();
  return (
    <header className="appbar">
      <div className="brand">
        <span className="mark"><Icon name="hub" /></span>
        <span className="name">Halda&nbsp;AI</span>
      </div>
      <button className="avatar" onClick={onAvatar} aria-label="Open profile">{initials(profile.name)}</button>
    </header>
  );
}
