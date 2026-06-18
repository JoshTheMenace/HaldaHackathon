"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Award, Flame, Sparkles, Star, Trophy } from "lucide-react";
import { useHalda, type RewardKind } from "@/lib/useHalda";

const ICONS: Record<RewardKind, React.ReactNode> = {
  xp: <Sparkles size={16} />,
  level: <Trophy size={16} />,
  badge: <Award size={16} />,
  quest: <Star size={16} />,
  match: <Flame size={16} />,
};

const STYLE: Record<RewardKind, string> = {
  xp: "bg-gold text-gold-ink",
  level: "bg-pine text-gold",
  badge: "bg-paper text-pine ring-1 ring-gold",
  quest: "bg-success text-white",
  match: "bg-coral text-white",
};

function Confetti() {
  const bits = Array.from({ length: 26 });
  const colors = ["var(--gold)", "var(--coral)", "var(--success)", "var(--pine)"];
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      {bits.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 6) * 0.05;
        const color = colors[i % colors.length];
        const rot = (i * 47) % 360;
        return (
          <motion.span
            key={i}
            initial={{ y: -30, x: `${left}vw`, opacity: 1, rotate: rot }}
            animate={{ y: "110vh", rotate: rot + 360, opacity: [1, 1, 0.7] }}
            transition={{ duration: 1.6 + (i % 5) * 0.18, delay, ease: "easeIn" }}
            className="absolute top-0 h-2.5 w-2.5 rounded-[2px]"
            style={{ background: color }}
          />
        );
      })}
    </div>
  );
}

export default function RewardToaster() {
  const { events, clearEvent } = useHalda();
  const hasBurst = events.some((e) => e.kind !== "xp");

  useEffect(() => {
    if (!events.length) return;
    const timers = events.map((e) =>
      window.setTimeout(() => clearEvent(e.id), e.kind === "xp" ? 1900 : 3600)
    );
    return () => timers.forEach(clearTimeout);
  }, [events, clearEvent]);

  return (
    <>
      <AnimatePresence>{hasBurst && <Confetti key="confetti" />}</AnimatePresence>
      <div className="pointer-events-none absolute bottom-24 right-5 z-[61] flex w-[282px] flex-col items-end gap-2">
        <AnimatePresence>
          {events.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-lift ${STYLE[e.kind]}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/10">
                {ICONS[e.kind]}
              </span>
              <span className="leading-tight">
                <span className="block font-display text-sm font-700">{e.label}</span>
                {e.sub && <span className="block text-xs opacity-90">{e.sub}</span>}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
