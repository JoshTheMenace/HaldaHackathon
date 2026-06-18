"use client";

import { useMemo, useRef, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { rankInterestMatches, schoolById } from "@/lib/interest-match";
import { ratingStrengths } from "@/lib/ratings";
import type { InterestAlignedSchoolScore } from "@/lib/interest-match";
import { Icon } from "./Icon";
import { CampusPhoto, SchoolLogo } from "./SchoolImage";
import MatchDetailSheet from "./MatchDetailSheet";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const roiLabel = (fit: number) => (fit >= 85 ? "Strong Alignment" : fit >= 70 ? "Good Value" : "Worth a Look");

export default function ExploreTab({ onAsk }: { onAsk: (text?: string) => void }) {
  const { profile, toggleSavedSchool } = useHalda();
  const deck = useMemo(() => rankInterestMatches(profile, 12), [profile]);
  const [idx, setIdx] = useState(0);
  const [gone, setGone] = useState<"" | "left" | "right">("");
  const [detail, setDetail] = useState<string | null>(null);

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
      <div className="sec-head" style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Top Recommendations</h2>
        <button className="link plain" onClick={() => onAsk("Explain my top school matches")}>See All</button>
      </div>
      <p className="tagline" style={{ margin: "0 0 14px" }}>Ranked by your interests, budget &amp; location — swipe right to save.</p>

      {current ? (
        <>
          <div className="stack">
            <div className="behind b2" />
            <div className="behind" />
            <SwipeCard m={current} gone={gone} tags={tagsFor(current)} onView={() => setDetail(current.schoolId)} onSwipe={swipe} />
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
              <button key={id} className="saved" onClick={() => setDetail(id)}>
                <div className="sc"><SchoolLogo id={id} /></div>
                <h5>{s.short}</h5>
                <span>{m ? `${m.overallFit}% Match` : "Saved"}</span>
              </button>
            );
          })}
        </div>
      )}

      <MatchDetailSheet schoolId={detail} onClose={() => setDetail(null)} onAsk={onAsk} />
    </main>
  );
}

function SwipeCard({ m, gone, tags, onView, onSwipe }: { m: InterestAlignedSchoolScore; gone: string; tags: string[]; onView: () => void; onSwipe: (dir: "left" | "right") => void }) {
  const s = schoolById(m.schoolId)!;
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const endDrag = (x: number) => {
    const dx = startX.current == null ? 0 : x - startX.current;
    startX.current = null;
    setDragX(0);
    if (Math.abs(dx) > 80) onSwipe(dx > 0 ? "right" : "left");
  };
  return (
    <article
      className={`swcard photo${gone ? " gone-" + gone : ""}`}
      style={gone || !dragX ? undefined : { transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`, transition: "none" }}
      onPointerDown={(e) => { startX.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (startX.current != null) setDragX(e.clientX - startX.current); }}
      onPointerUp={(e) => endDrag(e.clientX)}
      onPointerCancel={() => { startX.current = null; setDragX(0); }}
    >
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
        {m.rating && (
          <div className="sw-rating">
            <Icon name="star" className="st" />
            <b>{m.rating.overall.toFixed(1)}</b>
            <span>· {m.rating.reviewCount.toLocaleString()} students{ratingStrengths(m.rating, 4.0, 1)[0] ? ` love its ${ratingStrengths(m.rating, 4.0, 1)[0].label.toLowerCase()}` : ""}</span>
          </div>
        )}
        <div className="tags">{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
        <button className="cta" onClick={onView}>View Details</button>
      </div>
    </article>
  );
}
