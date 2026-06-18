"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, GraduationCap, HelpCircle, ShieldAlert, Sparkles, Target } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import { rankInterestMatches } from "@/lib/interest-match";
import { schoolById } from "@/lib/schools";
import { GuideStar } from "./brand";

const REACH: Record<string, string> = {
  safety: "bg-success/15 text-success",
  target: "bg-coral/15 text-coral-ink",
  reach: "bg-pine/10 text-pine",
};
const REACH_LABEL: Record<string, string> = {
  safety: "Likely you'll get in",
  target: "Strong match",
  reach: "A reach — worth a shot",
};
const CONF: Record<string, string> = { high: "bg-success", medium: "bg-gold", low: "bg-sage/50" };

export default function InterestMatches() {
  const { profile, matchesRevealed } = useHalda();
  const matches = useMemo(
    () => (matchesRevealed ? rankInterestMatches(profile, 5) : []),
    [profile, matchesRevealed]
  );

  if (!matchesRevealed)
    return (
      <div className="card flex flex-col items-center justify-center gap-2 p-6 text-center">
        <GuideStar size={26} fill="var(--mist)" />
        <p className="text-xs text-sage">
          Your right-fit matches light up here once Halda understands what you care about — and the intent behind it.
        </p>
      </div>
    );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <Target size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Where your interests become a path</h3>
        <span className="ml-auto text-[11px] font-600 text-sage">evidence-backed</span>
      </div>
      <AnimatePresence>
        {matches.map((m, i) => {
          const s = schoolById(m.schoolId)!;
          return (
            <motion.div key={m.schoolId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }} className="card overflow-hidden p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-700 text-white" style={{ background: s.accent }}>
                  {s.short.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-display text-sm font-700 text-pine">{s.short}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-700 ${REACH[m.reach]}`}>{REACH_LABEL[m.reach]}</span>
                  </div>
                  <div className="text-[11px] text-sage">{s.city}, {s.state} · about ${s.netPrice.toLocaleString()}/yr after aid</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-xl font-700 text-coral tnum">{m.overallFit}</div>
                  <div className="text-[9px] font-600 text-sage">FIT</div>
                </div>
              </div>

              {/* plain-language one-liner — what this place actually is */}
              <p className="mt-2 text-[11.5px] leading-snug text-pine/75">{s.vibe}</p>

              {/* per-interest fit */}
              {m.perInterest.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {m.perInterest.map((pi) => (
                    <span key={pi.interest} className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10.5px] font-600 text-pine ring-1 ring-line">
                      {cap(pi.interest)} <span className="text-sage">·</span> <span className="text-coral-ink">{prettyIntent(pi.intent)}</span> <b className="tnum text-coral">{pi.fit}</b>
                    </span>
                  ))}
                </div>
              )}

              {/* credit fit — "where your work counts" */}
              {m.creditFit.level !== "—" && (
                <div className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-line bg-cream/60 px-2.5 py-1.5">
                  <GraduationCap size={13} className="mt-0.5 shrink-0 text-coral" />
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-700 text-pine">
                      Credit fit: <span className={m.creditFit.level === "High" ? "text-success" : m.creditFit.level === "Low" ? "text-coral-ink" : "text-pine"}>{m.creditFit.level}</span>
                    </span>
                    <p className="text-[10.5px] leading-snug text-sage">{m.creditFit.summary}</p>
                  </div>
                </div>
              )}

              {/* reasons */}
              <ul className="mt-2.5 space-y-1">
                {m.reasons.map((r, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-[11.5px] text-pine/85">
                    <Check size={12} className="mt-0.5 shrink-0 text-success" />{r}
                  </li>
                ))}
              </ul>

              {/* evidence badges — the wow */}
              {m.evidenceBadges.length > 0 && (
                <div className="mt-2.5 rounded-xl border border-line bg-cream/60 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-700 uppercase tracking-wide text-sage">
                    <Sparkles size={10} className="text-coral" /> Evidence
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.evidenceBadges.slice(0, 5).map((b, j) => (
                      <span key={j} title={b.summary}
                        className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-1 text-[10.5px] font-600 text-pine ring-1 ring-line">
                        <span className={`h-1.5 w-1.5 rounded-full ${CONF[b.confidence]}`} />
                        {b.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* concerns + next questions */}
              {m.concerns.map((c, j) => (
                <p key={j} className="mt-2 flex items-start gap-1.5 text-[11px] text-coral-ink">
                  <ShieldAlert size={12} className="mt-0.5 shrink-0" />{c}
                </p>
              ))}
              {m.nextQuestions.length > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-sage">
                  <HelpCircle size={12} className="mt-0.5 shrink-0 text-coral" />
                  <span><b className="text-pine">Worth checking:</b> {m.nextQuestions[0]}</span>
                </p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function prettyIntent(i: string): string {
  return ({ career_path: "career", major: "major", serious_extracurricular: "serious", community: "community", fan_culture: "fan", personal_hobby: "hobby" } as Record<string, string>)[i] || i;
}
