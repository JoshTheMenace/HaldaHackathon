"use client";

import { useHalda } from "@/lib/useHalda";
import { QUESTS } from "@/lib/gamify";
import { tr } from "@/lib/i18n";
import { Icon } from "./Icon";
import { monthDay, nextStep, journeyProgress } from "./helpers";

export default function HomeTab({ onAsk, onGoExplore }: { onAsk: (text?: string) => void; onGoExplore: () => void }) {
  const { profile, matchesRevealed, language, level, completeness } = useHalda();
  const first = profile.name?.split(/\s+/)[0] || (language === "es" ? "hola" : "there");
  const step = nextStep(profile, matchesRevealed, language);
  const t = (key: string, fallback: string, vars: Record<string, string | number> = {}) => tr(language, key, fallback, vars);
  const { done, total, pct } = journeyProgress(profile, matchesRevealed);
  const onStep = () => (step.kind === "explore" ? onGoExplore() : onAsk(step.arg));
  const nextQuest = QUESTS.find((q) => !profile.completedQuests.includes(q.id));
  const toNext = level.next ? level.next.xp - profile.xp : 0;

  const upcoming = profile.tasks
    .filter((t) => t.status === "open" && t.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
    .slice(0, 2);

  const major = profile.intendedMajors[0] || (language === "es" ? "tu área" : "your field");

  return (
    <main className="scroll">
      <h1 className="greeting">{t("home.greeting", "Good morning, {name}!", { name: first })}</h1>
      <p className="tagline">{t("home.tagline", "I learn what you actually care about and find schools where it becomes a career — backed by real student reviews.")}</p>

      <section className="xp-card">
        <div className="xp-top">
          <span className="xp-badge"><Icon name="auto_awesome" /></span>
          <div className="xp-main">
            <span className="xp-eyebrow">{t("home.readiness", "College readiness")}</span>
            <h3>{language === "es" ? "Nivel" : "Level"} {level.current.level}: {level.current.name}</h3>
          </div>
          <div className="xp-score"><b>{profile.xp}</b><span>XP</span></div>
        </div>
        <div className="xp-bars">
          <div>
            <span>{t("home.nextLevel", "Next level")}</span>
            <div className="mini-track"><i style={{ width: `${level.pct}%` }} /></div>
            <small>{level.next ? (language === "es" ? `${toNext} XP para ${level.next.name}` : `${toNext} XP to ${level.next.name}`) : t("home.maxLevel", "Max level for now")}</small>
          </div>
          <div>
            <span>{t("tabs.profile", "Profile")}</span>
            <div className="mini-track profile"><i style={{ width: `${completeness}%` }} /></div>
            <small>{language === "es" ? `${completeness}% completo` : `${completeness}% complete`}</small>
          </div>
        </div>
        {nextQuest && (
          <button className="quest-chip" onClick={onStep}>
            <Icon name="flag" />
            <span><b>{t("home.nextQuest", "Next quest")}:</b> {nextQuest.title}</span>
            <em>+{nextQuest.xp} XP</em>
          </button>
        )}
      </section>

      {/* the Next Step engine — one contextual action, always */}
      <button className="nextstep" onClick={onStep}>
        <span className="ns-ico"><Icon name={step.icon} /></span>
        <div className="ns-b">
          <span className="ns-eyebrow">{t("home.next", "Next step")}</span>
          <h3>{step.title}</h3>
          <p>{step.sub}</p>
        </div>
        <span className="ns-cta"><Icon name="arrow_forward" /></span>
      </button>

      <div className="sec-head baseline">
        <h2>{t("home.schedule", "My Schedule")}</h2>
      </div>

      <section className="card sched">
        <div className="top">
          <div className="id">
            <span className="ico"><Icon name="checklist" /></span>
            <div>
              <h4>{t("home.journey", "Your college journey")}</h4>
              <span>{t("home.steps", "{done} of {total} steps done", { done, total })}</span>
            </div>
          </div>
          <div className="pct"><b>{pct}%</b><small>{t("home.done", "Done")}</small></div>
        </div>
        <div className="track"><i style={{ width: `${pct}%` }} /></div>

        <div className="dls">
          <span className="eyebrow">{t("home.deadlines", "Upcoming Deadlines")}</span>
          {upcoming.length === 0 && <p style={{ fontSize: 13, color: "var(--h-ink-var)" }}>{t("home.caught", "You're all caught up.")}</p>}
          {upcoming.map((task) => {
            const md = monthDay(task.due);
            return (
              <button key={task.id} className="dl" onClick={() => onAsk(language === "es" ? `Háblame de: ${task.title}` : `Tell me about: ${task.title}`)}>
                <div className={`datechip${md && new Date(task.due!) > new Date(Date.now() + 12096e5) ? " normal" : ""}`}>
                  <span className="m">{md?.m}</span><span className="d">{md?.d}</span>
                </div>
                <div className="b"><p>{task.title}</p><span>{task.detail || t("home.askGuide", "Tap to ask your guide")}</span></div>
                <Icon name="chevron_right" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="sec-head baseline">
        <div className="head-block">
          <h2>{t("home.suggestions", "Guide Suggestions")}</h2>
          <div className="sub">{t("home.personalized", "Personalized pathways for you")}</div>
        </div>
      </div>

      <section className="guides">
        <article className="hero teal">
          <span className="gico"><Icon name="medical_services" /></span>
          <h4>{t("home.careers", "Explore {major} Careers", { major })}</h4>
          <p>{t("home.careersBody", "Discover where this path can take you and what schools feed it.")}</p>
          <button className="pill" onClick={() => onAsk(language === "es" ? `¿A qué carreras me puede llevar ${major}?` : `What careers can ${major} lead to?`)}>
            {t("home.askHalda", "Ask Halda")} <Icon name="arrow_forward" />
          </button>
        </article>
        <article className="hero emerald">
          <span className="gico"><Icon name="payments" /></span>
          <h4>{t("home.scholarships", "Scholarships for you")}</h4>
          <p>{t("home.scholarshipsBody", "Find aid that fits your profile.")}</p>
          <button className="pill" onClick={() => onAsk(language === "es" ? "Busca becas para mí" : "Find scholarships for me")}>
            {t("home.findAid", "Find aid")} <Icon name="arrow_forward" />
          </button>
        </article>
      </section>
    </main>
  );
}
