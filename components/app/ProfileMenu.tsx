"use client";

import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import { initials, gradeLabel } from "./helpers";

export default function ProfileMenu({ open, onClose, onViewProfile, onConnect, onSettings }: { open: boolean; onClose: () => void; onViewProfile: () => void; onConnect: () => void; onSettings: () => void }) {
  const { profile, logout } = useHalda();
  if (!open) return null;

  const act = (fn: () => void) => { onClose(); fn(); };

  return (
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div className="profile-menu" role="menu">
        <div className="pm-head">
          <span className="pm-av">{initials(profile.name)}</span>
          <div className="pm-id"><b>{profile.name || "Your profile"}</b><span>{gradeLabel(profile.grade) || "Student"}</span></div>
        </div>
        <button className="pm-item" onClick={() => act(onViewProfile)}><Icon name="person" />View profile</button>
        <button className="pm-item" onClick={() => act(onConnect)}><Icon name="sync_alt" />Connect &amp; text<small>share, link your phone</small></button>
        <button className="pm-item" onClick={() => act(onSettings)}><Icon name="settings" />Settings<small>privacy, notifications</small></button>
        <button className="pm-item" onClick={() => act(logout)}><Icon name="logout" />Sign out<small>clear this browser</small></button>
      </div>
    </>
  );
}
