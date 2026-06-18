"use client";

import { useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { tr } from "@/lib/i18n";
import { BADGES } from "@/lib/gamify";
import { schoolById } from "@/lib/schools";
import { Icon } from "./Icon";
import { SchoolLogo } from "./SchoolImage";
import SettingsSheet from "./SettingsSheet";
import { initials, gradeLabel, dueLabel } from "./helpers";

const STATUS_LABEL: Record<string, string> = { review: "Under Review", draft: "Draft", action: "Action Needed", saved: "Saved" };
const CREDIT_TYPE: Record<string, string> = { ap: "AP", dual_enrollment: "Dual enrollment", ib: "IB", honors: "Honors", clep: "CLEP" };
const INTENT_LABEL: Record<string, string> = { career_path: "career", major: "major", serious_extracurricular: "serious", community: "community", fan_culture: "fan", personal_hobby: "hobby" };
const BADGE_ICON: Record<string, string> = {
  b_first_steps: "auto_awesome",
  b_early_bird: "wb_twilight",
  b_star_mapper: "stars",
  b_dreamer: "rocket_launch",
  b_planner: "checklist",
  b_on_a_roll: "local_fire_department",
  b_always_on: "smartphone",
  b_wordsmith: "edit_square",
};

const cap = (s?: string) => (s && s !== "any" ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const poolLocation = (p: { city?: string; state?: string; zip?: string }) =>
  [[p.city, p.state].filter(Boolean).join(", "), p.zip].filter(Boolean).join(" ");
const poolInterests = (p: { interestSignals: { interest: string; intent: string }[]; interests: string[] }) =>
  p.interestSignals.length
    ? p.interestSignals.map((s) => `${cap(s.interest)} (${INTENT_LABEL[s.intent] || s.intent})`).join(", ")
    : p.interests.map(cap).join(", ");

export default function ProfileTab({ onAvatar }: { onAvatar?: () => void }) {
  const { profile, toggleTask, editField, level, language } = useHalda();
  const t = (key: string, fallback: string, vars: Record<string, string | number> = {}) => tr(language, key, fallback, vars);
  const [poolOpen, setPoolOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sch = profile.scholarships ?? { applied: 0, won: 0, rejected: 0, pending: 0 };
  const tracked = profile.trackedSchools ?? [];
  const extras = profile.extracurriculars?.length ? profile.extracurriculars : profile.interestSignals.map((s) => s.interest);
  const earnedBadges = profile.badges.map((id) => ({ id, meta: BADGES[id] ?? { name: id, desc: "Unlocked", icon: "emoji_events" } }));

  return (
    <>
    <main className="scroll" style={{ padding: 0 }}>
      <header className="phead">
        <button className="pa" onClick={onAvatar} aria-label="Profile menu">{initials(profile.name)}</button>
        <div>
          <span className="eyebrow">{t("profile.student", "Student Profile")}</span>
          <h1>{profile.name || t("profile.your", "Your Profile")}</h1>
        </div>
        <button className="phead-menu" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Icon name="settings" /></button>
        <button className="phead-menu" onClick={onAvatar} aria-label="Menu"><Icon name="more_vert" /></button>
      </header>

      <div className="wrap">
        {/* deadlines */}
        <div className="sec-head"><h2>{t("profile.deadlines", "Upcoming Deadlines")}</h2></div>
        <section className="card">
          <div className="tasks">
            {profile.tasks.length === 0 && <p style={{ padding: "12px 0", fontSize: 13, color: "var(--h-ink-var)" }}>{t("profile.noDeadlines", "No deadlines yet — your guide will add them as you go.")}</p>}
            {profile.tasks.map((t) => {
              const done = t.status === "done";
              const overdue = !done && t.due ? new Date(t.due) < new Date() : false;
              return (
                <div key={t.id} className={`task${done ? " done" : ""}`}>
                  <button className={`box${done ? " done" : ""}`} onClick={() => toggleTask(t.id)} aria-label="Toggle">
                    {done && <Icon name="check" />}
                  </button>
                  <div className="b">
                    <div className="t"><span>{t.title}</span>{t.due && <span className={`due${overdue ? " red" : done ? " soft" : ""}`}>{dueLabel(t.due)}</span>}</div>
                    {t.detail && <div className="s">{t.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* university tracking */}
        <div className="sec-head"><h2>{t("profile.tracking", "University Tracking")}</h2></div>
        <section className="card">
          <div className="track-list">
            {tracked.length === 0 && <p style={{ padding: "10px 0", fontSize: 13, color: "var(--h-ink-var)" }}>{t("profile.noTracked", "Save schools on Explore to track them here.")}</p>}
            {tracked.map((ts) => {
              const s = schoolById(ts.id);
              return (
                <div key={ts.id} className="trow">
                  <span className="tinst">{s ? <SchoolLogo id={ts.id} /> : <Icon name="account_balance" />}</span>
                  <span className="nm">{ts.label || s?.name || ts.id}</span>
                  <span className={`status ${ts.status}`}>{STATUS_LABEL[ts.status]}</span>
                </div>
              );
            })}
          </div>
        </section>

        <h2 className="section-title">{t("profile.academicProfile", "Academic Profile")}</h2>

        {/* academic */}
        <section className="card cardpad">
          <div className="ch"><span className="l"><span className="i"><Icon name="school" /></span>{t("profile.academic", "Academic")}</span></div>
          <div className="grid2">
            <div className="metric"><div className="k">{t("profile.gpa", "Cumulative GPA")}</div><div className="v">{profile.gpa || "—"}</div></div>
            <div className="metric"><div className="k">{t("profile.testScore", "{test} Score", { test: profile.testType || "Test" })}</div><div className="v">{profile.testScore || "—"}</div></div>
          </div>
          {(profile.lettersTotal || profile.transcriptStatus) && (
            <>
              {profile.lettersTotal && <div className="mini"><b>Letters of Recommendation</b><span className="badge ok">{profile.lettersConfirmed ?? 0} of {profile.lettersTotal} Confirmed</span></div>}
              {profile.transcriptStatus && <div className="mini"><b>Transcript Status</b><span className="badge warn">{profile.transcriptStatus}</span></div>}
            </>
          )}
        </section>

        {/* scholarships */}
        <section className="card cardpad stack-gap">
          <div className="ch"><span className="l"><span className="i"><Icon name="savings" /></span>{t("profile.scholarship", "Scholarship Progress")}</span></div>
          <div className="grid3">
            <div className="metric center"><div className="k">{t("profile.applied", "Applied")}</div><div className="v">{sch.applied}</div></div>
            <div className="metric center won"><div className="k">{t("profile.won", "Won")}</div><div className="v">{sch.won}</div></div>
            <div className="metric center rej"><div className="k">{t("profile.rejected", "Rejected")}</div><div className="v">{sch.rejected}</div></div>
          </div>
          <div className="schol-foot">
            <div className="icons"><Icon name="emoji_events" /><Icon name="account_balance" /><Icon name="receipt_long" /></div>
            <span className="pend">{t("profile.pending", "{n} pending response", { n: sch.pending })}</span>
          </div>
        </section>

        {/* service */}
        {(profile.serviceHours != null || profile.serviceFocus) && (
          <section className="card cardpad stack-gap">
            <div className="ch"><span className="l"><span className="i"><Icon name="volunteer_activism" /></span>{t("profile.service", "Service")}</span></div>
            <div className="grid2">
              <div className="metric"><div className="k">{t("profile.hours", "Service Hours")}</div><div className="v">{profile.serviceHours ?? 0}<span style={{ fontSize: 15 }}> Hours</span></div></div>
              <div className="metric"><div className="k">{t("profile.focus", "Focus Area")}</div><div className="v txt">{profile.serviceFocus || "—"}</div></div>
            </div>
          </section>
        )}

        {/* extracurricular */}
        {extras.length > 0 && (
          <section className="card cardpad stack-gap">
            <div className="ch"><span className="l"><span className="i"><Icon name="groups" /></span>{t("profile.extra", "Extracurricular")}</span></div>
            <div className="chips">{extras.map((e) => <span key={e} className="chip">{e}</span>)}</div>
          </section>
        )}

        {/* credit wallet — a key differentiator */}
        {profile.creditWallet.length > 0 && (
          <section className="card cardpad stack-gap">
            <div className="ch">
              <span className="l"><span className="i"><Icon name="workspace_premium" /></span>{t("profile.credit", "Credit Wallet")}</span>
              <span className="badge ok">{t("profile.banked", "{n} banked", { n: profile.creditWallet.length })}</span>
            </div>
            <div className="credit-list">
              {profile.creditWallet.map((c) => (
                <div key={c.id} className="credit-row">
                  <div className="cr-b"><b>{c.source}</b><span>{CREDIT_TYPE[c.type] ?? c.type} · {c.subject}</span></div>
                  {c.score && <span className="cr-score">{c.score}</span>}
                </div>
              ))}
            </div>
            <p className="credit-note">{t("profile.creditNote", "College credit you've already banked — ask Halda where each one actually counts.")}</p>
          </section>
        )}

        {/* AI knowledge pool */}
        <section className="card stack-gap" style={{ overflow: "hidden" }}>
          <div className={`kpool${poolOpen ? " open" : ""}`} onClick={() => setPoolOpen((o) => !o)}>
            <span className="ki"><Icon name="hub" /></span>
            <span className="kt">{t("profile.knowledge", "AI Knowledge Pool")}</span>
            <Icon name="expand_more" className="chev" />
          </div>
          <div className={`kbody${poolOpen ? " open" : ""}`}>
            <p className="kintro">{t("profile.knowledgeIntro", "Everything Halda has learned to personalize your matches. Blanks are what she'll ask about next.")}</p>
            <div className="kbody-inner">
              <ReadField label={t("profile.grade", "Current Grade")} value={gradeLabel(profile.grade, language)} />
              <ReadField label={t("profile.age", "Age")} value={profile.age ? String(profile.age) : ""} />
              <ReadField label={t("profile.location", "Location")} value={poolLocation(profile)} />
              <ReadField label={t("profile.school", "High School")} value={profile.highSchool ?? ""} />
              <EditField label={t("profile.email", "Email")} value={profile.email ?? ""} onSave={(v) => editField("email", v)} />
              <EditField label={t("profile.phone", "Phone")} value={profile.phone ?? ""} onSave={(v) => editField("phone", v)} />
              <ReadField label={t("profile.interests", "Interests")} value={poolInterests(profile)} />
              <EditField label={t("profile.major", "Intended Major")} value={profile.intendedMajors[0] ?? ""} onSave={(v) => editField("intendedMajors", v ? [v] : [])} />
              <EditField label={t("profile.goal", "Career Goal")} value={profile.careerGoal ?? ""} onSave={(v) => editField("careerGoal", v)} />
              <EditField label={t("profile.gpa", "Cumulative GPA")} value={profile.gpa ?? ""} onSave={(v) => editField("gpa", v)} />
              <EditField label={t("profile.testScore", "{test} Score", { test: profile.testType || "Test" })} value={profile.testScore ?? ""} onSave={(v) => editField("testScore", v)} />
              <ReadField label={t("profile.close", "Stay Close to Home")} value={profile.stayInState ? `${t("profile.yes", "Yes")} — ${profile.state || "in-state"}` : profile.stayInState === false ? t("profile.openAnywhere", "Open to anywhere") : ""} />
              <ReadField label={t("profile.setting", "Campus Setting")} value={cap(profile.settingPref)} />
              <ReadField label={t("profile.size", "Campus Size")} value={cap(profile.sizePref)} />
              <ReadField label={t("profile.budget", "Budget")} value={profile.maxBudget ? `~$${profile.maxBudget.toLocaleString()}/yr` : ""} />
              <ReadField label={t("profile.aid", "Financial Aid")} value={profile.needsAid === true ? t("profile.needAid", "Needs aid") : profile.needsAid === false ? t("profile.noAid", "Not needed") : ""} />
              <ReadField label={t("profile.firstGen", "First-Generation")} value={profile.firstGen === true ? t("profile.yes", "Yes") : profile.firstGen === false ? "No" : ""} />
            </div>
          </div>
        </section>

        {/* Admissions Simulator handoff */}
        {profile.id && (
          <section className="card cardpad" style={{ marginTop: 4 }}>
            <div className="ch">
              <span className="l">
                <span className="i"><Icon name="analytics" /></span>
                Admissions Simulator
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--h-ink-var)", margin: "6px 0 12px", lineHeight: 1.55 }}>
              See how your profile looks to real college admissions committees — powered by AI.
            </p>
            <a
              href="/simulator"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "13px 16px",
                background: "var(--h-primary)",
                color: "#fff",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Run Admissions Simulator →
            </a>
          </section>
        )}
      </div>

      {/* achievements */}
      <div className="wrap"><div className="sec-head"><h2>{t("profile.achievements", "Achievements")}</h2></div></div>
      <div className="ach-row">
        {earnedBadges.length === 0 && (
          <div className="achv hero2">
            <span className="glow" />
            <span className="medal"><Icon name="workspace_premium" /></span>
            <div className="at"><div className="nm2">{t("profile.explorer", "Explorer")}</div><div className="desc">{language === "es" ? "Empieza a chatear para ganar tu primera insignia." : "Start chatting to earn your first badge."}</div></div>
          </div>
        )}
        {earnedBadges.map(({ id, meta }, i) => (
          <div key={id} className={`achv ${i === 0 ? "hero2" : "flat"}`}>
            {i === 0 && <span className="glow" />}
            <span className="medal"><Icon name={BADGE_ICON[id] || "emoji_events"} /></span>
            <div className="at"><div className="nm2">{meta.name}</div><div className="desc">{meta.desc}</div></div>
          </div>
        ))}
        <div className="achv flat">
          <span className="medal"><Icon name="trophy" /></span>
          <div className="at"><div className="nm2">{language === "es" ? "Nivel" : "Level"} {level.current.level}</div><div className="desc">{profile.xp} XP · {level.current.name}</div></div>
        </div>
        <div className="achv flat">
          <span className="medal"><Icon name="savings" /></span>
          <div className="at"><div className="nm2">{t("profile.scholarHunter", "Scholarship Hunter")}</div><div className="desc">{sch.won} of {sch.applied} won</div></div>
        </div>
        <div className="achv flat">
          <span className="medal"><Icon name="local_fire_department" /></span>
          <div className="at"><div className="nm2">{t("profile.streak", "On a Streak")}</div><div className="desc">{profile.streak}-day streak</div></div>
        </div>
      </div>
    </main>
    <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span style={{ flex: 1 }}><span className="lab">{label}</span><span className="val">{value || "—"}</span></span>
    </div>
  );
}

function EditField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <label className="field">
      <span style={{ flex: 1 }}>
        <span className="lab">{label}</span>
        <input className="val" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v.trim())} aria-label={label} />
      </span>
      <span className="ed" aria-hidden><Icon name="edit" /></span>
    </label>
  );
}
