"use client";

import { useState } from "react";
import { GraduationCap, Plus, Trash2, Wallet, X, Check } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import { walletPotential } from "@/lib/credit";
import type { CreditSourceType, CreditStatus } from "@/lib/types";

const STATUSES: CreditStatus[] = ["completed", "taking", "planned", "considering"];
const STATUS_TONE: Record<CreditStatus, string> = {
  completed: "bg-success/15 text-success",
  taking: "bg-coral/15 text-coral-ink",
  planned: "bg-gold/20 text-gold-ink",
  considering: "bg-pine/8 text-pine",
};
const TYPES: { v: CreditSourceType; label: string }[] = [
  { v: "ap", label: "AP" }, { v: "dual_enrollment", label: "Dual" },
  { v: "ib", label: "IB" }, { v: "honors", label: "Honors" }, { v: "clep", label: "CLEP" },
];

export default function CreditWallet() {
  const { profile, upsertCredit, removeCredit } = useHalda();
  const [adding, setAdding] = useState(false);
  const wallet = profile.creditWallet ?? [];

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Wallet size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Credit Wallet</h3>
        <button onClick={() => setAdding((a) => !a)} className="ml-auto text-sage hover:text-pine"><Plus size={14} /></button>
      </div>
      <p className="mb-2.5 text-[11px] text-sage">Where will your work actually count? AP, dual-enrollment & IB credit shape your matches.</p>

      {adding && <AddCredit onAdd={(c) => { upsertCredit({ ...c, id: "" }); setAdding(false); }} onClose={() => setAdding(false)} />}

      {wallet.length === 0 ? (
        <p className="text-[11.5px] text-sage">Tell Halda about your AP classes or dual-enrollment — it'll estimate how much counts at each school.</p>
      ) : (
        <div className="space-y-1.5">
          {wallet.map((c, i) => (
            <div key={c.id || i} className="flex items-center gap-2 rounded-xl border border-line bg-cream px-2.5 py-1.5">
              <GraduationCap size={14} className="shrink-0 text-coral" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-600 text-pine">{c.source}</span>
                  {c.score && c.score !== "unknown" && <span className="rounded bg-pine/8 px-1 text-[9.5px] font-700 text-pine">{c.score}</span>}
                </div>
                <div className="truncate text-[10px] text-sage">{walletPotential(c)}</div>
              </div>
              <select value={c.status} onChange={(e) => upsertCredit({ ...c, status: e.target.value as CreditStatus }, i)}
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-700 ${STATUS_TONE[c.status]}`}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => removeCredit(i)} className="shrink-0 text-sage/60 hover:text-coral"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCredit({ onAdd, onClose }: {
  onAdd: (c: { source: string; type: CreditSourceType; subject: string; status: CreditStatus; score?: string }) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState("");
  const [type, setType] = useState<CreditSourceType>("ap");
  const [subject, setSubject] = useState("");
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-coral/30 bg-coral/5 p-2">
      <input autoFocus value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. AP Biology"
        className="min-w-[110px] flex-1 bg-transparent text-[12px] text-pine outline-none" />
      <select value={type} onChange={(e) => setType(e.target.value as CreditSourceType)} className="rounded-md border border-line bg-paper px-1 py-0.5 text-[10.5px]">
        {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
      </select>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="subject"
        className="w-20 bg-transparent text-[11px] text-pine outline-none" />
      <button onClick={() => { if (source.trim()) onAdd({ source: source.trim(), type, subject: subject.trim() || "general", status: "taking" }); }} className="text-success"><Check size={15} /></button>
      <button onClick={onClose} className="text-sage"><X size={15} /></button>
    </div>
  );
}
