"use client";

import { useState } from "react";
import { schoolById } from "@/lib/schools";

// Live campus photo from Wikipedia/Wikimedia, with a branded fallback only if
// the public source cannot provide an image for that school.
export function CampusPhoto({ id, name, className }: { id: string; name?: string; className?: string }) {
  const [err, setErr] = useState(false);
  const s = schoolById(id);
  const school = name || s?.name || id;
  if (err) {
    return (
      <div className={className} style={{ width: "100%", height: "100%", background: `linear-gradient(150deg, ${s?.accent ?? "#0a6b5e"}, ${s?.accent ?? "#064a40"}cc)`, display: "grid", placeItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 38, letterSpacing: "-.02em" }}>{(s?.short ?? school).slice(0, 3)}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`/api/school-media?school=${encodeURIComponent(school)}&kind=campus`} alt={`${school} campus`} onError={() => setErr(true)} />;
}

// Live school logo/seal from Wikipedia/Wikimedia with initials fallback.
export function SchoolLogo({ id, name }: { id: string; name?: string }) {
  const [err, setErr] = useState(false);
  const s = schoolById(id);
  const school = name || s?.name || id;
  if (err) return <b style={{ color: s?.accent ?? "var(--h-primary)" }}>{(s?.short ?? school).slice(0, 2)}</b>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/school-media?school=${encodeURIComponent(school)}&kind=logo`} alt={`${school} logo`} onError={() => setErr(true)} />;
}
