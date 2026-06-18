"use client";

import { useState } from "react";
import { CalendarClock, Check, ListChecks, Plus, Trash2, X } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import type { TaskKind } from "@/lib/types";

function fmtDue(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const KIND_TONE: Record<TaskKind, string> = {
  deadline: "bg-coral/15 text-coral-ink",
  todo: "bg-pine/8 text-pine",
  milestone: "bg-gold/20 text-gold-ink",
};

export default function TasksPanel() {
  const { profile, toggleTask, removeTask, addTask } = useHalda();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const tasks = [...profile.tasks].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">Tasks & deadlines</h3>
        <span className="ml-auto text-[11px] font-600 text-sage tnum">{tasks.filter((t) => t.status === "open").length} open</span>
        <button onClick={() => setAdding((a) => !a)} className="text-sage hover:text-pine"><Plus size={14} /></button>
      </div>

      {adding && (
        <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-coral/30 bg-coral/5 p-2">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task…"
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { addTask({ title: text.trim(), kind: "todo" }); setText(""); setAdding(false); } }}
            className="flex-1 bg-transparent text-[12px] text-pine outline-none" />
          <button onClick={() => { if (text.trim()) { addTask({ title: text.trim(), kind: "todo" }); setText(""); setAdding(false); } }} className="text-success"><Check size={15} /></button>
          <button onClick={() => setAdding(false)} className="text-sage"><X size={15} /></button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-[11.5px] text-sage">As Halda learns your situation, real deadlines (like the FAFSA) show up here — with the actual dates.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t) => {
            const due = fmtDue(t.due);
            const done = t.status === "done";
            return (
              <div key={t.id} className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 ${done ? "bg-success/8" : "bg-cream"}`}>
                <button onClick={() => toggleTask(t.id)}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-success bg-success text-white" : "border-line bg-paper text-transparent hover:border-coral"}`}>
                  <Check size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`flex items-center gap-1.5 text-[12.5px] font-600 ${done ? "text-sage line-through" : "text-pine"}`}>
                    <span className="truncate">{t.title}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-700 ${KIND_TONE[t.kind]}`}>{t.kind}</span>
                  </div>
                  {due && <div className="flex items-center gap-1 text-[10.5px] font-600 text-coral-ink"><CalendarClock size={10} /> {due}</div>}
                  {t.detail && <div className="mt-0.5 text-[10.5px] leading-snug text-sage">{t.detail}</div>}
                </div>
                <button onClick={() => removeTask(t.id)} className="mt-0.5 text-sage/60 hover:text-coral"><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
