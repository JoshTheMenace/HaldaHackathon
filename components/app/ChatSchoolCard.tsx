"use client";

import { useHalda } from "@/lib/useHalda";
import { schoolById } from "@/lib/schools";
import { ratingFor } from "@/lib/ratings";
import { Icon } from "./Icon";
import { CampusPhoto, SchoolLogo } from "./SchoolImage";

// A compact, interactive school card rendered inline in the chat: tap to open
// details, heart to save — without ever leaving the conversation.
export default function ChatSchoolCard({ schoolId, matchPct, onOpen }: { schoolId: string; matchPct: number; onOpen: () => void }) {
  const { profile, toggleSavedSchool } = useHalda();
  const s = schoolById(schoolId);
  if (!s) return null;
  const r = ratingFor(schoolId);
  const saved = profile.savedSchoolIds?.includes(schoolId) ?? false;

  return (
    <div className="csc" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <span className="csc-photo">
        <CampusPhoto id={schoolId} />
        <span className="csc-logo"><SchoolLogo id={schoolId} /></span>
      </span>
      <div className="csc-b">
        <div className="csc-top"><b>{s.short}</b><span className="csc-pct">{matchPct}% match</span></div>
        <div className="csc-sub">~${s.netPrice.toLocaleString()}/yr after aid{r ? ` · ${r.overall}★` : ""}</div>
      </div>
      <button className={`csc-save${saved ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); toggleSavedSchool(schoolId); }} aria-label={saved ? "Unsave" : "Save"}>
        <Icon name={saved ? "favorite" : "favorite_border"} />
      </button>
    </div>
  );
}
