"use client";

import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import { monthDay, nextStep, journeyProgress } from "./helpers";

export default function HomeTab({ onAsk, onGoExplore }: { onAsk: (text?: string) => void; onGoExplore: () => void }) {
  const { profile, matchesRevealed } = useHalda();
  const first = profile.name?.split(/\s+/)[0] || "there";
  const step = nextStep(profile, matchesRevealed);
  const { done, total, pct } = journeyProgress(profile, matchesRevealed);
  const onStep = () => (step.kind === "explore" ? onGoExplore() : onAsk(step.arg));

  const upcoming = profile.tasks
    .filter((t) => t.status === "open" && t.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
    .slice(0, 2);

  const major = profile.intendedMajors[0] || "your field";

  return (
    <main className="scroll">
      <h1 className="greeting">Good morning, {first}!</h1>
      <p className="tagline">I learn what you actually care about and find schools where it becomes a career — backed by real student reviews.</p>

      {/* the Next Step engine — one contextual action, always */}
      <button className="nextstep" onClick={onStep}>
        <span className="ns-ico"><Icon name={step.icon} /></span>
        <div className="ns-b">
          <span className="ns-eyebrow">Next step</span>
          <h3>{step.title}</h3>
          <p>{step.sub}</p>
        </div>
        <span className="ns-cta"><Icon name="arrow_forward" /></span>
      </button>

      <div className="sec-head baseline">
        <h2>My Schedule</h2>
        <button className="link plain" onClick={onGoExplore}>View Calendar</button>
      </div>

      <section className="card sched">
        <div className="top">
          <div className="id">
            <span className="ico"><Icon name="checklist" /></span>
            <div>
              <h4>Your college journey</h4>
              <span>{done} of {total} steps done</span>
            </div>
          </div>
          <div className="pct"><b>{pct}%</b><small>Done</small></div>
        </div>
        <div className="track"><i style={{ width: `${pct}%` }} /></div>

        <div className="dls">
          <span className="eyebrow">Upcoming Deadlines</span>
          {upcoming.length === 0 && <p style={{ fontSize: 13, color: "var(--h-ink-var)" }}>You&apos;re all caught up. 🎉</p>}
          {upcoming.map((t) => {
            const md = monthDay(t.due);
            return (
              <button key={t.id} className="dl" onClick={() => onAsk(`Tell me about: ${t.title}`)}>
                <div className={`datechip${md && new Date(t.due!) > new Date(Date.now() + 12096e5) ? " normal" : ""}`}>
                  <span className="m">{md?.m}</span><span className="d">{md?.d}</span>
                </div>
                <div className="b"><p>{t.title}</p><span>{t.detail || "Tap to ask your guide"}</span></div>
                <Icon name="chevron_right" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="sec-head baseline">
        <div className="head-block">
          <h2>Guide Suggestions</h2>
          <div className="sub">Personalized pathways for you</div>
        </div>
      </div>

      <section className="guides">
        <article className="hero teal">
          <span className="gico"><Icon name="medical_services" /></span>
          <h4>Explore {major} Careers</h4>
          <p>Discover where this path can take you and what schools feed it.</p>
          <button className="pill" onClick={() => onAsk(`What careers can ${major} lead to?`)}>
            Ask Halda <Icon name="arrow_forward" />
          </button>
        </article>
        <article className="hero emerald">
          <span className="gico"><Icon name="payments" /></span>
          <h4>Scholarships for you</h4>
          <p>Find aid that fits your profile{profile.firstGen ? ", including first-gen funding" : ""}.</p>
          <button className="pill" onClick={() => onAsk("Find scholarships for me")}>
            Find aid <Icon name="arrow_forward" />
          </button>
        </article>
      </section>
    </main>
  );
}
