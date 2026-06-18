"use client";

import { TrendingUp } from "lucide-react";

const FUNNEL = [
  ["Reach", "14.0M", 100],
  ["Started SMS/voice", "182K", 60],
  ["Activated profile", "100K", 38, true],
  ["Sellable to schools", "64K", 27],
] as const;

export default function GTMPanel() {
  return (
    <div className="rounded-xl2 border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp size={16} className="text-coral" />
        <h2 className="font-display text-base font-700 text-pine">The path to 100K — why this is a business</h2>
        <span className="ml-auto rounded-full bg-mist px-2.5 py-1 text-[11px] font-700 text-coral-ink">bonus GTM</span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-sage">
        100K activated sophomores in 9 months for ~<b className="text-pine">$640K</b> (~$6.40 CAC), funded by schools
        buying named, <b className="text-pine">intent-signaled</b> leads at $45–90 — <b className="text-pine">12–20×</b> our
        student CAC. Engagement <i>is</i> the inventory: a warm, already-engaged lead beats any cold ad funnel.
      </p>
      <div className="mt-3 space-y-1.5">
        {FUNNEL.map(([label, val, w, gold]) => (
          <div key={label} className="flex items-center gap-2.5">
            <div className="w-32 shrink-0 text-right text-[11px] font-600 text-sage">{label}</div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-[#eef1f0]">
              <div className={`flex h-full items-center rounded-lg ${gold ? "bg-gold" : "bg-pine"}`} style={{ width: `${w}%` }}>
                <span className={`pl-2.5 font-display text-[12px] font-700 tnum ${gold ? "text-gold-ink" : "text-cream"}`}>{val}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[["~$6.40", "CAC"], ["~$63", "LTV"], ["~10×", "LTV:CAC"], ["80%+", "margin"]].map(([b, s]) => (
          <div key={s} className="rounded-xl border border-line bg-cream px-2 py-2">
            <div className="font-display text-base font-700 text-pine tnum">{b}</div>
            <div className="text-[10px] text-sage">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
