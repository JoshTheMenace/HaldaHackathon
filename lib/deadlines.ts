import type { TaskItem, TaskKind } from "./types";

// Resolve canonical college-prep deadlines from the student's grade, so a
// sophomore who "qualifies for FAFSA" gets the actual filing window on their
// list — not generic advice. Dates are computed relative to graduation year.

function gradYear(grade?: number): number {
  const now = new Date();
  const g = grade ?? 10;
  // After June, the current grade is considered finished.
  const finishedThisGrade = now.getMonth() >= 6;
  const yearsLeft = Math.max(0, 12 - g - (finishedThisGrade ? 0 : 0));
  return now.getFullYear() + yearsLeft;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

interface Resolved {
  title: string;
  detail: string;
  due: string;
  kind: TaskKind;
}

export const DEADLINE_KEYS = [
  "fafsa", "css_profile", "psat", "common_app", "early_action", "regular_decision", "college_list",
] as const;
export type DeadlineKey = (typeof DEADLINE_KEYS)[number];

export function resolveDeadline(key: string, grade?: number): Resolved | null {
  const gy = gradYear(grade);
  switch (key) {
    case "fafsa":
      return {
        title: "File the FAFSA",
        detail: `Opens Oct 1, ${gy - 1} for the ${gy}–${gy + 1} aid year. File as early as you can — some federal and state aid is first-come, first-served.`,
        due: iso(gy - 1, 10, 1),
        kind: "deadline",
      };
    case "css_profile":
      return {
        title: "Submit the CSS Profile",
        detail: `Needed by many private colleges for institutional aid. Opens ~Oct 1, ${gy - 1}. Check each school's exact date.`,
        due: iso(gy - 1, 10, 1),
        kind: "deadline",
      };
    case "psat":
      return {
        title: "Take the PSAT/NMSQT",
        detail: `Offered in October of junior year — it's the National Merit Scholarship qualifier, so it can mean real money.`,
        due: iso(gy - 2, 10, 15),
        kind: "deadline",
      };
    case "common_app":
      return {
        title: "Start your Common App",
        detail: `Opens Aug 1, ${gy - 1}. Get the basics + essay in early so senior fall isn't chaos.`,
        due: iso(gy - 1, 8, 1),
        kind: "deadline",
      };
    case "early_action":
      return {
        title: "Early Action / Early Decision deadlines",
        detail: `Most fall around Nov 1, ${gy - 1}. Applying early can boost your odds at some schools.`,
        due: iso(gy - 1, 11, 1),
        kind: "deadline",
      };
    case "regular_decision":
      return {
        title: "Regular Decision deadlines",
        detail: `Many land around Jan 1, ${gy}. Have your list locked well before then.`,
        due: iso(gy, 1, 1),
        kind: "deadline",
      };
    case "college_list":
      return {
        title: "Build a balanced college list",
        detail: `Aim for a healthy mix of reach / target / safety schools by junior spring.`,
        due: iso(gy - 1, 4, 1),
        kind: "todo",
      };
    default:
      return null;
  }
}

let _t = 0;
export function makeTask(input: {
  key?: string; title?: string; detail?: string; due?: string; kind?: TaskKind;
}, grade?: number): TaskItem {
  const resolved = input.key ? resolveDeadline(input.key, grade) : null;
  return {
    id: `task_${Date.now()}_${_t++}`,
    title: input.title || resolved?.title || "Follow up",
    detail: input.detail || resolved?.detail,
    due: input.due || resolved?.due,
    kind: (input.kind as TaskKind) || resolved?.kind || "todo",
    status: "open",
    source: "halda",
    key: input.key,
  };
}
