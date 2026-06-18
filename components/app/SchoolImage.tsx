"use client";

import { useState } from "react";
import { schoolById } from "@/lib/schools";

// Cached campus photo with a branded gradient + initials fallback (e.g. Olin).
export function CampusPhoto({ id, className }: { id: string; className?: string }) {
  const [err, setErr] = useState(false);
  const s = schoolById(id);
  if (err || !s) {
    return (
      <div className={className} style={{ width: "100%", height: "100%", background: `linear-gradient(150deg, ${s?.accent ?? "#0a6b5e"}, ${s?.accent ?? "#064a40"}cc)`, display: "grid", placeItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 38, letterSpacing: "-.02em" }}>{s?.short.slice(0, 3) ?? "·"}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`/schools/${id}-campus.jpg`} alt={`${s.name} campus`} onError={() => setErr(true)} />;
}

// Cached school logo/seal with an accent-initials fallback.
export function SchoolLogo({ id }: { id: string }) {
  const [err, setErr] = useState(false);
  const s = schoolById(id);
  if (err || !s) return <b style={{ color: s?.accent ?? "var(--h-primary)" }}>{s?.short.slice(0, 2) ?? "·"}</b>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/schools/${id}-logo.png`} alt={`${s.name} logo`} onError={() => setErr(true)} />;
}
