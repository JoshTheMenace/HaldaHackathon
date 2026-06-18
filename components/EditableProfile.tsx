"use client";

import { useState } from "react";
import { Brain, Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import type { InterestIntent, Importance } from "@/lib/types";

const INTENTS: { v: InterestIntent; label: string }[] = [
  { v: "career_path", label: "Career" },
  { v: "major", label: "Major" },
  { v: "serious_extracurricular", label: "Serious" },
  { v: "community", label: "Community" },
  { v: "fan_culture", label: "Fan" },
  { v: "personal_hobby", label: "Hobby" },
];
const IMPORTANCES: Importance[] = ["low", "medium", "high", "must_have"];

function gradeLabel(g?: number) {
  return g ? ({ 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" }[g] || `Grade ${g}`) : "";
}

export default function EditableProfile() {
  const { profile, editField, upsertInterestSignal, removeInterestSignal } = useHalda();
  const [editing, setEditing] = useState(false);

  const rows: { key: string; label: string; value: string; onSave: (v: string) => void }[] = [
    { key: "name", label: "Name", value: profile.name ?? "", onSave: (v) => editField("name", v) },
    { key: "grade", label: "Grade", value: profile.grade ? String(profile.grade) : "", onSave: (v) => editField("grade", parseInt(v) || undefined) },
    { key: "city", label: "City", value: profile.city ?? "", onSave: (v) => editField("city", v) },
    { key: "highSchool", label: "High school", value: profile.highSchool ?? "", onSave: (v) => editField("highSchool", v) },
    { key: "goal", label: "Goal", value: profile.careerGoal ?? "", onSave: (v) => editField("careerGoal", v) },
    { key: "phone", label: "Phone", value: profile.phone ?? "", onSave: (v) => editField("phone", v) },
    { key: "email", label: "Email", value: profile.email ?? "", onSave: (v) => editField("email", v) },
  ];

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Brain size={15} className="text-coral" />
        <h3 className="font-display text-sm font-700 text-pine">What Halda knows</h3>
        <button onClick={() => setEditing((e) => !e)}
          className="ml-auto flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-600 text-sage hover:text-pine">
          {editing ? <Check size={12} /> : <Pencil size={12} />} {editing ? "Done" : "Edit"}
        </button>
      </div>

      {/* core fields */}
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <Field key={r.key} label={r.label} value={r.value} editing={editing}
            display={r.key === "grade" ? gradeLabel(profile.grade) : r.value}
            onSave={r.onSave} />
        ))}
      </div>

      {(profile.firstGen || profile.needsAid || profile.stayInState) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.firstGen && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-700 text-gold-ink">First-gen</span>}
          {profile.needsAid && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-700 text-success">Needs aid</span>}
          {profile.stayInState && <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-700 text-coral-ink">Staying in {profile.state ?? "state"}</span>}
        </div>
      )}

      {/* interest signals */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-700 uppercase tracking-wide text-sage">
          <Sparkles size={11} className="text-coral" /> Interests & intent
        </div>
        {profile.interestSignals.length === 0 ? (
          <p className="text-[11.5px] text-sage">Tell Halda what you care about — it learns the intent behind it (career? community? just for fun?).</p>
        ) : (
          <div className="space-y-1.5">
            {profile.interestSignals.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-xl border border-line bg-cream px-2.5 py-1.5">
                <span className="flex-1 truncate text-[12.5px] font-600 text-pine">{cap(s.interest)}</span>
                {editing ? (
                  <>
                    <select value={s.intent} onChange={(e) => upsertInterestSignal({ ...s, intent: e.target.value as InterestIntent }, i)}
                      className="rounded-md border border-line bg-paper px-1 py-0.5 text-[10.5px] text-pine">
                      {INTENTS.map((it) => <option key={it.v} value={it.v}>{it.label}</option>)}
                    </select>
                    <select value={s.importance} onChange={(e) => upsertInterestSignal({ ...s, importance: e.target.value as Importance }, i)}
                      className="rounded-md border border-line bg-paper px-1 py-0.5 text-[10.5px] text-pine">
                      {IMPORTANCES.map((im) => <option key={im} value={im}>{im.replace("_", " ")}</option>)}
                    </select>
                    <button onClick={() => removeInterestSignal(i)} className="text-sage hover:text-coral"><Trash2 size={13} /></button>
                  </>
                ) : (
                  <>
                    <Tag>{INTENTS.find((it) => it.v === s.intent)?.label ?? s.intent}</Tag>
                    {s.importance === "must_have" && <Tag tone="gold">must-have</Tag>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {editing && <AddInterest onAdd={(v) => upsertInterestSignal(v)} />}
      </div>
    </div>
  );
}

function Field({ label, value, display, editing, onSave }: {
  label: string; value: string; display: string; editing: boolean; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="rounded-xl border border-line bg-cream px-2.5 py-1.5">
      <div className="text-[9.5px] font-700 uppercase tracking-wide text-sage">{label}</div>
      {editing ? (
        <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)}
          placeholder="—"
          className="w-full bg-transparent text-[12.5px] font-600 text-pine outline-none" />
      ) : (
        <div className="truncate text-[12.5px] font-600 text-pine">{display || <span className="text-sage/60">—</span>}</div>
      )}
    </div>
  );
}

function AddInterest({ onAdd }: { onAdd: (s: { interest: string; intent: InterestIntent; importance: Importance }) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<InterestIntent>("personal_hobby");
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1 rounded-full border border-dashed border-coral/40 px-2.5 py-1 text-[11px] font-600 text-coral-ink">
        <Plus size={12} /> Add an interest
      </button>
    );
  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-coral/30 bg-coral/5 p-2">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. soccer"
        className="flex-1 bg-transparent text-[12px] text-pine outline-none" />
      <select value={intent} onChange={(e) => setIntent(e.target.value as InterestIntent)}
        className="rounded-md border border-line bg-paper px-1 py-0.5 text-[10.5px]">
        {INTENTS.map((it) => <option key={it.v} value={it.v}>{it.label}</option>)}
      </select>
      <button onClick={() => { if (text.trim()) { onAdd({ interest: text.trim(), intent, importance: "medium" }); setText(""); setOpen(false); } }}
        className="text-success"><Check size={15} /></button>
      <button onClick={() => setOpen(false)} className="text-sage"><X size={15} /></button>
    </div>
  );
}

const Tag = ({ children, tone }: { children: React.ReactNode; tone?: "gold" }) => (
  <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-700 ${tone === "gold" ? "bg-gold/25 text-gold-ink" : "bg-pine/8 text-pine"}`}>{children}</span>
);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
