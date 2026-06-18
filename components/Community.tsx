"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Users } from "lucide-react";
import { useHalda } from "@/lib/useHalda";

// A lightweight ZeeMee-style cohort: anonymized peers (first name only) doing
// the same journey. Tied to the live profile so it feels relevant, not random.
interface Peer {
  name: string; major: string; state: string; city: string;
  level: number; levelName: string; status: string; accent: string;
}

const PEERS: Peer[] = [
  { name: "Liam", major: "Computer Science", state: "WA", city: "Seattle", level: 4, levelName: "Strategist", status: "just lit their constellation ✨", accent: "#4b2e83" },
  { name: "Devon", major: "Engineering", state: "TX", city: "Houston", level: 4, levelName: "Strategist", status: "saved a balanced list 📌", accent: "#500000" },
  { name: "Aisha", major: "Biology", state: "GA", city: "Atlanta", level: 3, levelName: "Trailblazer", status: "found 2 scholarships 💸", accent: "#0b5394" },
  { name: "Noah", major: "Aerospace", state: "CO", city: "Boulder", level: 5, levelName: "Frontrunner", status: "on an 11-day streak 🔥", accent: "#cfb87c" },
  { name: "Sofia", major: "Business", state: "AZ", city: "Tempe", level: 2, levelName: "Pathfinder", status: "just getting started 🌱", accent: "#8c1d40" },
];

export default function Community() {
  const { profile, matchesRevealed } = useHalda();
  const [waved, setWaved] = useState<Set<string>>(new Set());

  const peers = useMemo(() => {
    const myMajor = profile.intendedMajors[0];
    const myState = profile.state;
    return [...PEERS]
      .map((p) => ({
        p,
        score: (p.major === myMajor ? 2 : 0) + (p.state === myState ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.p);
  }, [profile.intendedMajors, profile.state]);

  if (!matchesRevealed) return null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Sophomores like you</h3>
        <span className="ml-auto rounded-full bg-mist px-2 py-0.5 text-[10px] font-700 text-coral-ink">
          Class of 2028
        </span>
      </div>
      <div className="space-y-2">
        {peers.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-2.5 rounded-xl bg-cream px-2.5 py-2"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-xs font-700 text-white"
              style={{ background: p.accent }}
            >
              {p.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] font-700 text-pine">{p.name}</span>
                <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-700 text-gold-ink">
                  Lv {p.level}
                </span>
              </div>
              <div className="truncate text-[10.5px] text-sage">
                {p.major} · {p.city}, {p.state} · {p.status}
              </div>
            </div>
            <button
              onClick={() => setWaved((s) => new Set(s).add(p.name))}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-700 transition ${
                waved.has(p.name)
                  ? "bg-success/15 text-success"
                  : "border border-coral/40 text-coral-ink hover:bg-coral/10"
              }`}
            >
              {waved.has(p.name) ? "Waved 👋" : "Wave 👋"}
            </button>
          </motion.div>
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-1 text-[10.5px] text-sage">
        <Sparkles size={11} className="text-coral" /> Anonymized by default — you choose what to share.
      </p>
    </div>
  );
}
