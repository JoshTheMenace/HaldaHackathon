"use client";

import { useMemo, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { rankInterestMatches, schoolById } from "@/lib/interest-match";
import { ratingStrengths } from "@/lib/ratings";
import type { InterestAlignedSchoolScore } from "@/lib/interest-match";
import { Icon } from "./Icon";
import { CampusPhoto, SchoolLogo } from "./SchoolImage";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const roiLabel = (fit: number) => (fit >= 85 ? "Strong Alignment" : fit >= 70 ? "Good Value" : "Worth a Look");

export default function ExploreTab({ onAsk }: { onAsk: (text?: string) => void }) {
  const { profile, toggleSavedSchool } = useHalda();
  const deck = useMemo(() => rankInterestMatches(profile, 12), [profile]);
  const [idx, setIdx] = useState(0);
  const [gone, setGone] = useState<"" | "left" | "right">("");
  const [detail, setDetail] = useState<InterestAlignedSchoolScore | null>(null);

  const current = deck[idx];
  const saved = profile.savedSchoolIds ?? [];

  const swipe = (dir: "left" | "right") => {
    if (!current || gone) return;
    if (dir === "right") toggleSavedSchool(current.schoolId, true);
    setGone(dir);
    setTimeout(() => { setIdx((i) => i + 1); setGone(""); }, 350);
  };

  const tagsFor = (m: InterestAlignedSchoolScore) => {
    const s = schoolById(m.schoolId)!;
    const top = profile.intendedMajors[0] || profile.interestSignals[0]?.interest || s.strongMajors[0];
    const strength = m.rating ? ratingStrengths(m.rating, 4.0, 1)[0]?.label : undefined;
    return [`#${cap(top).replace(/\s+/g, "")}`, `#${s.state}`, strength ? `#${strength.replace(/\s+/g, "")}` : `#${cap(s.setting)}`];
  };

  return (
    <main className="scroll">
      <div className="sec-head">
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Top Recommendations</h2>
        <button className="link plain" onClick={() => onAsk("Explain my top school matches")}>See All</button>
      </div>

      {current ? (
        <>
          <div className="stack">
            <div className="behind b2" />
            <div className="behind" />
            <SwipeCard m={current} gone={gone} tags={tagsFor(current)} onView={() => setDetail(current)} />
          </div>

          <div className="ctrl">
            <div className="swipe">
              <button className="scbtn no" aria-label="Skip" onClick={() => swipe("left")}><Icon name="close" /></button>
              <span className="lab">Swipe Left</span>
            </div>
            <div className="swipe">
              <button className="scbtn yes" aria-label="Save" onClick={() => swipe("right")}><Icon name="check" /></button>
              <span className="lab">Swipe Right</span>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-stack">You&apos;ve been through your top matches. Check your saved list below, or ask your guide for more.</div>
      )}

      <h2 className="saved-head">Saved Matches</h2>
      {saved.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--h-ink-var)" }}>Swipe right on a school to save it here.</p>
      ) : (
        <div className="gridsaved">
          {saved.map((id) => {
            const s = schoolById(id);
            const m = deck.find((x) => x.schoolId === id);
            if (!s) return null;
            return (
              <button key={id} className="saved" onClick={() => m && setDetail(m)}>
                <div className="sc"><SchoolLogo id={id} /></div>
                <h5>{s.short}</h5>
                <span>{m ? `${m.overallFit}% Match` : "Saved"}</span>
              </button>
            );
          })}
        </div>
      )}

      <MatchDetail m={detail} onClose={() => setDetail(null)} onAsk={onAsk} />
    </main>
  );
}

function SwipeCard({ m, gone, tags, onView }: { m: InterestAlignedSchoolScore; gone: string; tags: string[]; onView: () => void }) {
  const s = schoolById(m.schoolId)!;
  return (
    <article className={`swcard photo${gone ? " gone-" + gone : ""}`}>
      <div className="sw-photo">
        <CampusPhoto id={s.id} />
        <span className="logo-badge"><SchoolLogo id={s.id} /></span>
      </div>
      <div className="sw-body">
        <div className="idrow">
          <h3>{s.short}</h3>
          <span className="matchpill">{m.overallFit}% Match</span>
        </div>
        <p className="roi">ROI: <b>{roiLabel(m.overallFit)}</b></p>
        <div className="tags">{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
        <button className="cta" onClick={onView}>View Details</button>
      </div>
    </article>
  );
}

function MatchDetail({ m, onClose, onAsk }: { m: InterestAlignedSchoolScore | null; onClose: () => void; onAsk: (t?: string) => void }) {
  const open = !!m;
  const s = m ? schoolById(m.schoolId) : null;
  const academic = (m?.interestFit ?? 0) >= 60;
  const financial = (m?.affordabilityFit ?? 0) >= 60;
  const C = 276.46; // 2πr, r=44
  const offset = m ? C * (1 - m.overallFit / 100) : C;
  const insight = m
    ? `${m.reasons[0] || s?.vibe || ""}${m.rating ? ` Students who go here rate it ${m.rating.overall}★ (${m.rating.reviewCount.toLocaleString()} reviews).` : ""}`
    : "";

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
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
            <button className="tour-btn" onClick={() => { onClose(); onAsk(`Why is ${s.short} a good fit for me?`); }}>
              Ask why it fits
            </button>
          </>
        )}
      </section>
    </>
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
