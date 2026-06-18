"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Award, BookOpen, Brain, Check, DollarSign, Flame, GraduationCap,
  Heart, Lock, MapPin, Sparkles, Target, TrendingUp, Trophy, Users,
} from "lucide-react";
import { useHalda, useMatches } from "@/lib/useHalda";
import { BADGES, QUESTS } from "@/lib/gamify";
import { schoolById } from "@/lib/schools";
import { titleCase } from "@/lib/match";
import type { StudentProfile } from "@/lib/types";
import { GuideStar } from "./brand";

function gradeLabel(g?: number) {
  return g ? ({ 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" }[g] || `Grade ${g}`) : undefined;
}

// ── Player header: avatar in a guide-star progress ring + level + XP + streak ──
export function PlayerHeader() {
  const { profile, level, completeness } = useHalda();
  const initials = (profile.name || "?")
    .split(/\s+/).map((w) => w[0]?.toUpperCase()).slice(0, 2).join("");
  const C = 2 * Math.PI * 30;

  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="relative grid h-[76px] w-[76px] place-items-center">
        <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
          <circle cx="36" cy="36" r="30" fill="none" stroke="var(--mist)" strokeWidth="6" />
          <motion.circle
            cx="36" cy="36" r="30" fill="none" stroke="var(--coral)" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={C}
            animate={{ strokeDashoffset: C - (C * level.pct) / 100 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </svg>
        <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-pine font-display text-lg font-700 text-cream">
          {initials}
        </div>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 py-0.5 font-display text-[10px] font-700 text-gold-ink shadow-soft">
          LVL {level.current.level}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-display text-lg font-700 text-pine">
            {profile.name || "New student"}
          </h2>
          {gradeLabel(profile.grade) && (
            <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-600 text-coral-ink">
              {gradeLabel(profile.grade)}
            </span>
          )}
        </div>
        <div className="text-xs font-600 text-sage">{level.current.name}</div>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-sm font-700 text-pine">
            <Sparkles size={14} className="text-gold" />
            <span className="tnum">{profile.xp}</span>
            <span className="text-[11px] font-500 text-sage">XP</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-700 text-coral">
            <Flame size={14} />
            <span className="tnum">{profile.streak}</span>
            <span className="text-[11px] font-500 text-sage">day streak</span>
          </span>
          <span className="ml-auto text-[11px] font-600 text-sage">
            {completeness}% known
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Memory: the literal "it knows me" panel that fills as you talk ─────────────
const FACT_ICONS: Record<string, React.ReactNode> = {
  grade: <GraduationCap size={13} />,
  location: <MapPin size={13} />,
  interests: <Heart size={13} />,
  major: <Target size={13} />,
  setting: <Users size={13} />,
  size: <Users size={13} />,
  aid: <DollarSign size={13} />,
  goal: <Brain size={13} />,
};

function facts(p: StudentProfile): { key: string; label: string }[] {
  const f: { key: string; label: string }[] = [];
  if (p.grade) f.push({ key: "grade", label: gradeLabel(p.grade)! });
  if (p.city || p.state) f.push({ key: "location", label: [p.city, p.state].filter(Boolean).join(", ") });
  p.interests.forEach((i) => f.push({ key: "interests", label: i }));
  p.intendedMajors.forEach((m) => f.push({ key: "major", label: m }));
  if (p.settingPref) f.push({ key: "setting", label: `${titleCase(p.settingPref)} campus` });
  if (p.sizePref) f.push({ key: "size", label: `${titleCase(p.sizePref)} school` });
  if (p.needsAid) f.push({ key: "aid", label: "Needs aid" });
  if (p.maxBudget) f.push({ key: "aid", label: `~$${(p.maxBudget / 1000).toFixed(0)}k/yr budget` });
  if (p.careerGoal) f.push({ key: "goal", label: p.careerGoal });
  return f;
}

export function MemoryCard() {
  const { profile } = useHalda();
  const f = facts(profile);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Brain size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">What Halda knows</h3>
        <span className="ml-auto text-[11px] font-600 text-sage tnum">{f.length} facts</span>
      </div>
      {f.length === 0 ? (
        <p className="text-xs text-sage">
          Halda's listening… every detail you share gets remembered here — forever, across every channel.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {f.map((x, i) => (
              <motion.span
                key={`${x.key}-${x.label}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-2.5 py-1 text-[11.5px] font-600 text-pine"
              >
                <span className="text-coral">{FACT_ICONS[x.key]}</span>
                {x.label}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Quests ────────────────────────────────────────────────────────────────────
export function QuestRail() {
  const { profile } = useHalda();
  const visible = QUESTS.slice(0, 8);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Quests</h3>
        <span className="ml-auto text-[11px] font-600 text-sage tnum">
          {profile.completedQuests.length}/{QUESTS.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((q) => {
          const done = profile.completedQuests.includes(q.id);
          return (
            <div
              key={q.id}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
                done ? "bg-success/8" : "bg-cream"
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  done ? "bg-success text-white" : "border border-line bg-paper text-sage"
                }`}
              >
                {done ? <Check size={13} /> : <Target size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[12.5px] font-600 ${done ? "text-sage line-through" : "text-pine"}`}>
                  {q.title}
                </div>
                <div className="truncate text-[10.5px] text-sage">{q.stage}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-700 tnum ${
                done ? "bg-success/15 text-success" : "bg-gold/20 text-gold-ink"
              }`}>
                +{q.xp}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────
export function BadgeShelf() {
  const { profile } = useHalda();
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Award size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Badges</h3>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(BADGES).map(([id, b]) => {
          const earned = profile.badges.includes(id);
          return (
            <div key={id} className="flex flex-col items-center gap-1 text-center" title={b.desc}>
              <motion.span
                initial={false}
                animate={{ scale: earned ? 1 : 0.92 }}
                className={`grid h-11 w-11 place-items-center rounded-full ${
                  earned ? "bg-gold text-gold-ink shadow-glow" : "bg-mist/60 text-sage/50"
                }`}
              >
                {earned ? <Award size={18} /> : <Lock size={14} />}
              </motion.span>
              <span className={`text-[9px] font-600 leading-tight ${earned ? "text-pine" : "text-sage/60"}`}>
                {b.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Matches ───────────────────────────────────────────────────────────────────
const REACH_STYLE: Record<string, string> = {
  safety: "bg-success/15 text-success",
  target: "bg-coral/15 text-coral-ink",
  reach: "bg-pine/10 text-pine",
};

export function MatchList() {
  const matches = useMatches();
  const { matchesRevealed } = useHalda();

  if (!matchesRevealed)
    return (
      <div className="card flex flex-col items-center justify-center gap-2 p-6 text-center">
        <GuideStar size={26} fill="var(--mist)" />
        <p className="text-xs text-sage">
          Your right-fit matches light up here once Halda knows enough about you.
        </p>
      </div>
    );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <Target size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Your right-fit schools</h3>
        <span className="ml-auto text-[11px] font-600 text-sage">ranked for you</span>
      </div>
      <AnimatePresence>
        {matches.map((m, i) => {
          const s = schoolById(m.schoolId)!;
          return (
            <motion.div
              key={m.schoolId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card overflow-hidden p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-700 text-white"
                  style={{ background: s.accent }}
                >
                  {s.short.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-display text-sm font-700 text-pine">{s.short}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-700 capitalize ${REACH_STYLE[m.reach]}`}>
                      {m.reach}
                    </span>
                  </div>
                  <div className="text-[11px] text-sage">
                    {s.city}, {s.state} · ${s.netPrice.toLocaleString()}/yr net
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-xl font-700 text-coral tnum">{m.fit}</div>
                  <div className="text-[9px] font-600 text-sage">FIT</div>
                </div>
              </div>
              <ul className="mt-2.5 space-y-1">
                {m.reasons.map((r, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-[11.5px] text-pine/80">
                    <Check size={12} className="mt-0.5 shrink-0 text-success" />
                    {r}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Channel strip: web (active) + SMS handoff + email ─────────────────────────
export function ChannelStrip({ onOpenSMS, onOpenEmail }: { onOpenSMS: () => void; onOpenEmail: () => void }) {
  const { profile } = useHalda();
  const sms = profile.channelsLinked.includes("sms");
  const email = profile.channelsLinked.includes("email");
  return (
    <div className="card flex items-center gap-2 p-2.5">
      <span className="flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1.5 text-[11px] font-700 text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Web
      </span>
      <button
        onClick={onOpenSMS}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-700 transition ${
          sms ? "bg-success/12 text-success" : "bg-coral text-white shadow-soft hover:scale-[1.03]"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${sms ? "bg-success" : "bg-white"}`} />
        {sms ? "SMS linked" : "Take Halda with you →"}
      </button>
      <button
        onClick={onOpenEmail}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-700 transition ${
          email ? "bg-success/12 text-success" : "bg-mist/60 text-sage hover:bg-mist"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${email ? "bg-success" : "bg-sage/50"}`} /> Email
      </button>
      <span className="ml-auto hidden items-center gap-1 pr-1 text-[10px] font-600 text-sage sm:flex">
        <TrendingUp size={12} /> one memory, every channel
      </span>
    </div>
  );
}
