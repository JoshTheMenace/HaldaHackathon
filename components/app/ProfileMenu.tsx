"use client";

import { useHalda } from "@/lib/useHalda";
import { tr } from "@/lib/i18n";
import { Icon } from "./Icon";
import { initials, gradeLabel } from "./helpers";

export default function ProfileMenu({ open, onClose, onViewProfile, onConnect, onSettings }: { open: boolean; onClose: () => void; onViewProfile: () => void; onConnect: () => void; onSettings: () => void }) {
  const { profile, logout, language } = useHalda();
  const t = (key: string, fallback: string) => tr(language, key, fallback);
  if (!open) return null;

  const act = (fn: () => void) => { onClose(); fn(); };

  return (
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div className="profile-menu" role="menu">
        <div className="pm-head">
          <span className="pm-av">{initials(profile.name)}</span>
          <div className="pm-id"><b>{profile.name || t("profile.your", "Your profile")}</b><span>{gradeLabel(profile.grade, language) || t("profile.student", "Student")}</span></div>
        </div>
        <button className="pm-item" onClick={() => act(onViewProfile)}><Icon name="person" />{t("menu.viewProfile", "View profile")}</button>
        <button className="pm-item" onClick={() => act(onConnect)}><Icon name="sync_alt" />{t("menu.connect", "Connect & text")}<small>{t("menu.connectSub", "share, link your phone")}</small></button>
        <button className="pm-item" onClick={() => act(onSettings)}><Icon name="settings" />{t("menu.settings", "Settings")}<small>{t("menu.settingsSub", "privacy, notifications")}</small></button>
        <button className="pm-item" onClick={() => act(logout)}><Icon name="logout" />{t("menu.signOut", "Sign out")}<small>{t("menu.signOutSub", "clear this browser")}</small></button>
      </div>
    </>
  );
}
