"use client";

import { motion } from "framer-motion";
import { Flame, Mail, Star, X } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import { rankMatches } from "@/lib/match";
import { schoolById } from "@/lib/schools";
import { GuideStar } from "./brand";

// An async email check-in mockup — same memory, days later. Proves "always-on"
// re-engagement: it opens by NAME and references facts it learned earlier.
export default function EmailPanel({ onClose }: { onClose: () => void }) {
  const { profile } = useHalda();
  const first = profile.name?.split(" ")[0] || "there";
  const top = rankMatches(profile, 3)
    .map((m) => schoolById(m.schoolId))
    .filter(Boolean)
    .slice(0, 2);
  const major = profile.intendedMajors[0] || "your major";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="w-[380px] overflow-hidden rounded-2xl border border-line bg-paper shadow-lift"
    >
      {/* mail client chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-cream/70 px-4 py-2.5">
        <Mail size={15} className="text-coral" />
        <span className="text-[12px] font-700 text-pine">Inbox</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-700 text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> async check-in
        </span>
        <button onClick={onClose} className="ml-1 grid h-6 w-6 place-items-center rounded-full text-sage hover:bg-line">
          <X size={14} />
        </button>
      </div>

      {/* message */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5 border-b border-line pb-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-pine text-gold">
            <GuideStar size={17} fill="var(--gold)" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-700 text-pine">Halda</span>
              <span className="text-[11px] text-sage">·  3 days later</span>
            </div>
            <div className="truncate text-[11px] text-sage">to {first.toLowerCase()}@email · re: your college journey</div>
          </div>
        </div>

        <h3 className="mt-3 font-display text-[15px] font-700 text-pine">
          {first}, I found 2 scholarships you actually qualify for 💸
        </h3>

        <div className="mt-2 space-y-2.5 text-[12.5px] leading-relaxed text-pine/85">
          <p>Hey {first} — picking up right where we left off. I didn't forget a thing:</p>
          <ul className="space-y-1 rounded-xl border border-line bg-cream px-3 py-2 text-[12px]">
            <li className="flex items-center gap-1.5"><Star size={11} className="text-coral" /> {major} intent</li>
            <li className="flex items-center gap-1.5"><Star size={11} className="text-coral" /> {profile.city || "your area"} · {profile.needsAid ? "aid-sensitive" : "on budget"}</li>
            <li className="flex items-center gap-1.5"><Flame size={11} className="text-coral" /> {profile.streak}-day streak — your flame's safe, I had a freeze token on you</li>
          </ul>
          <p>
            Based on that, two strong-aid picks for {major}:{" "}
            <b className="text-pine">{top.map((s) => s!.short).join(" and ")}</b>. Both come in
            well under sticker once aid kicks in.
          </p>
          <p className="text-sage">Reply <b className="text-pine">YES</b> and I'll add them to your list (+25 XP for checking in) 🎓</p>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-xl bg-coral py-2 text-[12.5px] font-700 text-white">Reply: YES, add them</button>
          <button onClick={onClose} className="rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] font-600 text-sage">Later</button>
        </div>
      </div>
    </motion.div>
  );
}
