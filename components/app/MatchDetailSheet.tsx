"use client";

import { useEffect, useMemo, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { scoreInterestFit, schoolById } from "@/lib/interest-match";
import { Icon } from "./Icon";
import { CampusPhoto } from "./SchoolImage";

const C = 276.46; // 2πr, r=44
type ScorecardFacts = {
  location?: string;
  acceptanceRate?: number;
  netPrice?: number;
  undergradSize?: number;
  completionRate?: number;
  medianEarnings?: number;
  source: string;
};

const pct = (n?: number) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const money = (n?: number) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);
const count = (n?: number) => (n == null ? "—" : Math.round(n).toLocaleString());

// Shared school detail sheet used by both Explore and the AI Guide chat.
export default function MatchDetailSheet({ schoolId, onClose, onAsk }: { schoolId: string | null; onClose: () => void; onAsk: (t?: string) => void }) {
  const { profile, toggleSavedSchool } = useHalda();
  const open = !!schoolId;
  const s = schoolId ? schoolById(schoolId) : null;
  const m = useMemo(() => (s ? scoreInterestFit(profile, s) : null), [profile, s]);
  const saved = schoolId ? (profile.savedSchoolIds?.includes(schoolId) ?? false) : false;
  const [facts, setFacts] = useState<ScorecardFacts | null>(null);
  const [factsLoading, setFactsLoading] = useState(false);

  useEffect(() => {
    if (!s) { setFacts(null); return; }
    const ctrl = new AbortController();
    setFactsLoading(true);
    setFacts(null);
    fetch(`/api/school-scorecard?school=${encodeURIComponent(s.name)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setFacts(d.scorecard ?? null))
      .catch(() => { if (!ctrl.signal.aborted) setFacts(null); })
      .finally(() => { if (!ctrl.signal.aborted) setFactsLoading(false); });
    return () => ctrl.abort();
  }, [s]);

  const academic = (m?.interestFit ?? 0) >= 60;
  const financial = (m?.affordabilityFit ?? 0) >= 60;
  const offset = m ? C * (1 - m.overallFit / 100) : C;
  const insight = m && s
    ? `${m.reasons[0] || s.vibe || ""}${m.rating ? ` Students who go here rate it ${m.rating.overall}★ (${m.rating.reviewCount.toLocaleString()} reviews).` : ""}`
    : "";

  return (
    <>
      <div className={`scrim detail-scrim${open ? " on" : ""}`} onClick={onClose} />
      <section className={`sheet detail${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Match Details">
        <span className="grab" />
        <div className="sheet-head">
          <h2>Match Details</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {m && s && (
          <>
            <div className="detail-photo">
              <CampusPhoto id={s.id} />
              <div className="pin"><span>{s.name}</span></div>
            </div>
            <div className="detail-card">
              <div className="detail-top">
                <div className="ring">
                  <svg width="104" height="104" viewBox="0 0 104 104">
                    <circle cx="52" cy="52" r="44" stroke="#e0e6e4" strokeWidth="9" fill="none" />
                    <circle cx="52" cy="52" r="44" stroke="#16b89e" strokeWidth="9" fill="none" strokeLinecap="round"
                      strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 52 52)" />
                  </svg>
                  <div className="ring-val"><b>{m.overallFit}%</b><small>Match</small></div>
                </div>
                <div className="fits">
                  <FitPill icon="school" label="Academic Fit" ok={academic} />
                  <FitPill icon="account_balance_wallet" label="Financial" ok={financial} />
                </div>
              </div>
              <div className="detail-div" />
              <div className="insight-eyebrow"><Icon name="auto_awesome" />AI Insight</div>
              <p className="insight-text">{insight}</p>
            </div>
            <div className="scorecard-panel">
              <div className="scorecard-head">
                <span><Icon name="query_stats" />Official Scorecard facts</span>
                <small>{facts ? facts.source : factsLoading ? "Loading..." : "Catalog fallback"}</small>
              </div>
              <div className="fact-grid">
                <Fact label="Acceptance" value={pct(facts?.acceptanceRate ?? s.acceptanceRate)} />
                <Fact label="Avg net price" value={money(facts?.netPrice ?? s.netPrice)} />
                <Fact label="Undergrads" value={count(facts?.undergradSize)} fallback={cap(s.size)} />
                <Fact label="Grad rate" value={pct(facts?.completionRate)} />
                <Fact label="Earnings" value={money(facts?.medianEarnings)} sub="10 yrs" />
                <Fact label="Setting" value={cap(s.setting)} />
              </div>
              <div className="program-list">
                <b>Strong areas</b>
                <span>{s.strongMajors.join(" · ")}</span>
              </div>
            </div>
            <div className="detail-actions">
              <button className={`tour-btn${saved ? " saved" : ""}`} onClick={() => toggleSavedSchool(s.id)}>
                <Icon name={saved ? "favorite" : "favorite_border"} /> {saved ? "Saved" : "Save"}
              </button>
              <button className="tour-btn" onClick={() => { onClose(); onAsk(`Why is ${s.short} a good fit for me?`); }}>Ask why it fits</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Fact({ label, value, fallback, sub }: { label: string; value: string; fallback?: string; sub?: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <b>{value === "—" && fallback ? fallback : value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function FitPill({ icon, label, ok }: { icon: string; label: string; ok: boolean }) {
  return (
    <div className="fitpill">
      <span className="fic"><Icon name={icon} /></span>
      <b>{label}</b>
      {ok ? <Icon name="check_circle" className="chk" /> : <Icon name="radio_button_unchecked" />}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
