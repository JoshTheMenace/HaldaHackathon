// Small presentation helpers shared across the mobile app screens.

export type Tab = "home" | "explore" | "profile" | "connect" | "cohort";

export function initials(name?: string): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthDay(iso?: string): { m: string; d: string } | null {
  if (!iso) return null;
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return null;
  return { m: MONTHS[d.getMonth()], d: String(d.getDate()).padStart(2, "0") };
}

export function dueLabel(iso?: string): string {
  const md = monthDay(iso);
  return md ? `Due ${md.m} ${parseInt(md.d, 10)}` : "";
}

export function gradeLabel(g?: number): string {
  if (!g) return "";
  return { 9: "Freshman (9th)", 10: "Sophomore (10th)", 11: "Junior (11th)", 12: "Senior (12th)" }[g] ?? `Grade ${g}`;
}

// ── The "Next Step" engine: one contextual action derived from where the
// student is in their journey. Turns every feature into a single story.
import type { StudentProfile } from "@/lib/types";

export interface NextStep {
  icon: string;
  title: string;
  sub: string;
  cta: string;
  kind: "ask" | "explore";
  arg?: string; // starter prompt when kind === "ask"
}

export function nextStep(p: StudentProfile, revealed: boolean): NextStep {
  const saved = p.savedSchoolIds?.length ?? 0;
  const hasInterest = p.interestSignals.length > 0 || p.intendedMajors.length > 0;
  const hasFafsa = p.tasks.some((t) => t.key === "fafsa");
  const openTasks = p.tasks.filter((t) => t.status === "open" && t.due).sort((a, b) => (a.due! < b.due! ? -1 : 1));

  if (!p.name) return { icon: "waving_hand", title: "Introduce yourself to Halda", sub: "Tell me your name and what you're into — I'll take it from there.", cta: "Start chatting", kind: "ask" };
  if (!hasInterest) return { icon: "favorite", title: "Tell me what you care about", sub: "Your real interests are what I match schools to.", cta: "Tell Halda", kind: "ask", arg: "Here's what I'm into…" };
  if (!revealed) return { icon: "auto_awesome", title: "See your school matches", sub: "I know enough to find schools that actually fit you.", cta: "Find my matches", kind: "ask", arg: "What schools should I look at?" };
  if (saved === 0) return { icon: "swipe", title: "Save your favorite schools", sub: "Swipe right on the ones that feel like you.", cta: "Open Explore", kind: "explore" };
  if (p.needsAid && !hasFafsa) return { icon: "savings", title: "Lock in the FAFSA", sub: "It's the front door to aid you never pay back.", cta: "Add it to my list", kind: "ask", arg: "Add the FAFSA to my tasks" };
  if (openTasks[0]) {
    const t = openTasks[0];
    return { icon: "event_available", title: t.title, sub: `${dueLabel(t.due)}${t.detail ? " · " + t.detail : ""}`, cta: "Get help with this", kind: "ask", arg: `Help me with: ${t.title}` };
  }
  return { icon: "verified", title: "You're on track 🎯", sub: "Ask me anything — scholarships, essays, deadlines.", cta: "Ask Halda", kind: "ask" };
}

// Real journey progress (advances as the student actually does things).
export function journeyProgress(p: StudentProfile, revealed: boolean): { done: number; total: number; pct: number } {
  const steps = [
    !!p.name && !!p.grade,
    p.interestSignals.length > 0 || p.intendedMajors.length > 0,
    !!p.state || !!p.zip,
    p.needsAid === true || !!p.maxBudget,
    revealed,
    (p.savedSchoolIds?.length ?? 0) > 0,
    p.tasks.length > 0,
    p.creditWallet.length > 0,
    p.tasks.some((t) => t.status === "done"),
    !!p.careerGoal,
  ];
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
}

// A signature of the ranked match list — changes when new info re-ranks.
export function matchSignature(matches: { schoolId: string; overallFit: number }[]): string {
  return matches.slice(0, 5).map((m) => `${m.schoolId}:${m.overallFit}`).join("|");
}
