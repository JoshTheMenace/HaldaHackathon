"use client";

import { useMemo, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { rankInterestMatches, schoolById } from "@/lib/interest-match";
import { Icon } from "./Icon";
import { SchoolLogo } from "./SchoolImage";
import { dueLabel } from "./helpers";

export default function SharePlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useHalda();
  const [copied, setCopied] = useState(false);

  const top = useMemo(() => rankInterestMatches(profile, 4), [profile]);
  const openTasks = profile.tasks.filter((t) => t.status === "open").slice(0, 4);

  const summaryText = useMemo(() => {
    const lines = [
      `${profile.name || "Student"}'s College Plan (via Halda)`,
      profile.careerGoal ? `Goal: ${profile.careerGoal}` : "",
      "",
      "TOP MATCHES:",
      ...top.map((m) => {
        const s = schoolById(m.schoolId)!;
        return `• ${s.name} — ${m.overallFit}% match, ~$${s.netPrice.toLocaleString()}/yr after aid. ${m.reasons[0] ?? ""}`;
      }),
      "",
      "NEXT STEPS:",
      ...openTasks.map((t) => `• ${t.title}${t.due ? ` (${dueLabel(t.due)})` : ""}`),
    ];
    return lines.filter((l) => l !== undefined).join("\n");
  }, [profile, top, openTasks]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op */ }
  };

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <section className={`sheet share${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Share plan">
        <span className="grab" />
        <div className="sheet-head">
          <h2>Your College Plan</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="plan-scroll">
          <div className="plan-hero">
            <b>{profile.name || "Your plan"}</b>
            <span>{[profile.careerGoal, profile.intendedMajors[0]].filter(Boolean).join(" · ") || "Building your path"}</span>
          </div>

          <div className="plan-label">Top matches</div>
          {top.map((m) => {
            const s = schoolById(m.schoolId)!;
            return (
              <div key={m.schoolId} className="plan-row">
                <span className="plan-logo"><SchoolLogo id={s.id} /></span>
                <div className="plan-b">
                  <div className="plan-t"><b>{s.short}</b><span className="plan-pct">{m.overallFit}%</span></div>
                  <span className="plan-sub">~${s.netPrice.toLocaleString()}/yr after aid · {m.reasons[0] ?? s.vibe}</span>
                </div>
              </div>
            );
          })}

          {openTasks.length > 0 && (
            <>
              <div className="plan-label">Next steps</div>
              {openTasks.map((t) => (
                <div key={t.id} className="plan-step">
                  <Icon name="radio_button_unchecked" />
                  <span>{t.title}{t.due ? ` · ${dueLabel(t.due)}` : ""}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="plan-foot">
          <button className="cta" onClick={copy}>
            <Icon name={copied ? "check" : "content_copy"} /> {copied ? "Copied to clipboard" : "Copy summary to share"}
          </button>
        </div>
      </section>
    </>
  );
}
