"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useHalda } from "@/lib/useHalda";

// A single progress bar that fills as the student's profile builds and they get
// closer to a real list of schools to work toward. Replaces the old "journey"
// constellation — clearer, and it actually moves as things happen.
export default function Constellation() {
  const { profile, matchesRevealed } = useHalda();

  const steps = [
    { label: "About you", done: !!profile.name && !!profile.grade, weight: 15 },
    { label: "Interests", done: profile.interestSignals.length > 0 || profile.intendedMajors.length > 0, weight: 20 },
    { label: "Location", done: !!profile.state || !!profile.zip, weight: 15 },
    { label: "Money plan", done: profile.needsAid === true || !!profile.maxBudget, weight: 15 },
    { label: "Matches", done: matchesRevealed, weight: 20 },
    { label: "Your list", done: profile.tasks.length > 0, weight: 15 },
  ];
  const pct = Math.min(100, steps.reduce((s, x) => s + (x.done ? x.weight : 0), 0));

  const caption =
    pct >= 100 ? "You've got a list to work toward 🎯" :
    pct >= 80 ? "Almost there — refining your list." :
    pct >= 50 ? "Getting close — let's find your matches." :
    pct >= 20 ? "Building your profile…" :
    "Just getting started — tell me about you.";

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-700 text-pine">Your progress</h3>
        <span className="font-display text-sm font-700 text-coral tnum">{pct}%</span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-mist">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-coral to-gold"
          initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      <p className="mt-2 text-[11.5px] font-600 text-sage">{caption}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((s) => (
          <span key={s.label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-700 ${
              s.done ? "bg-success/15 text-success" : "bg-cream text-sage ring-1 ring-line"}`}>
            {s.done && <Check size={10} />} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
