import type { ProfileField, StudentProfile } from "./types";
import { profileCompleteness } from "./match";

// ── Levels: a "College Readiness" ladder that feels like leveling up a character.
export interface Level {
  level: number;
  name: string;
  xp: number; // xp required to reach
  blurb: string;
}

export const LEVELS: Level[] = [
  { level: 1, name: "Explorer", xp: 0, blurb: "Just getting started." },
  { level: 2, name: "Pathfinder", xp: 100, blurb: "You've got a direction." },
  { level: 3, name: "Trailblazer", xp: 300, blurb: "Standing out on purpose." },
  { level: 4, name: "Strategist", xp: 600, blurb: "Your list is taking shape." },
  { level: 5, name: "Frontrunner", xp: 1000, blurb: "Applications in motion." },
  { level: 6, name: "Future Freshman", xp: 1600, blurb: "Decision time." },
];

export function levelFor(xp: number): { current: Level; next?: Level; pct: number } {
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) current = l;
  const next = LEVELS.find((l) => l.xp > current.xp);
  const span = next ? next.xp - current.xp : 1;
  const into = xp - current.xp;
  const pct = next ? Math.min(100, Math.round((into / span) * 100)) : 100;
  return { current, next, pct };
}

// ── XP awarded when Halda learns a new field (the "aha, it remembered" moment).
export const FIELD_XP: Record<ProfileField, number> = {
  name: 20,
  grade: 20,
  location: 25,
  interests: 30,
  major: 35,
  setting: 20,
  size: 20,
  budget: 30,
  goal: 35,
};

// ── Quests: the journey from sophomore year to decision day.
export type Stage = "Discover" | "Build" | "Strengthen" | "Apply" | "Decide";

export interface Quest {
  id: string;
  title: string;
  desc: string;
  stage: Stage;
  xp: number;
  done: (p: StudentProfile) => boolean;
}

export const QUESTS: Quest[] = [
  {
    id: "q_meet",
    title: "Meet Halda",
    desc: "Say hi and tell Halda your name.",
    stage: "Discover",
    xp: 20,
    done: (p) => !!p.name,
  },
  {
    id: "q_map",
    title: "Put yourself on the map",
    desc: "Share your grade and where you're from.",
    stage: "Discover",
    xp: 30,
    done: (p) => !!p.grade && !!(p.zip || p.state),
  },
  {
    id: "q_spark",
    title: "Find your spark",
    desc: "Tell Halda what you're into — add 2+ interests.",
    stage: "Discover",
    xp: 35,
    done: (p) => p.interests.length >= 2,
  },
  {
    id: "q_direction",
    title: "Name a direction",
    desc: "Pick a major you're curious about.",
    stage: "Discover",
    xp: 35,
    done: (p) => p.intendedMajors.length >= 1,
  },
  {
    id: "q_campus",
    title: "Picture your campus",
    desc: "Choose a setting and size that feel like you.",
    stage: "Build",
    xp: 30,
    done: (p) => !!p.settingPref && !!p.sizePref,
  },
  {
    id: "q_money",
    title: "Money talk",
    desc: "Be real about budget so matches make sense.",
    stage: "Build",
    xp: 30,
    done: (p) => !!p.maxBudget || p.needsAid === true,
  },
  {
    id: "q_constellation",
    title: "Light your constellation",
    desc: "Unlock your first set of right-fit matches.",
    stage: "Build",
    xp: 40,
    done: (p) => profileCompleteness(p) >= 55,
  },
  {
    id: "q_list",
    title: "Build your list",
    desc: "Save a balanced list: a reach, a target, a safety.",
    stage: "Strengthen",
    xp: 45,
    done: (p) => p.completedQuests.includes("q_list"),
  },
  {
    id: "q_essay",
    title: "Essay spark",
    desc: "Brainstorm a story only you could tell.",
    stage: "Strengthen",
    xp: 50,
    done: (p) => p.completedQuests.includes("q_essay"),
  },
  {
    id: "q_aid",
    title: "Hunt scholarships",
    desc: "Find aid you actually qualify for.",
    stage: "Strengthen",
    xp: 45,
    done: (p) => p.completedQuests.includes("q_aid"),
  },
  {
    id: "q_sms",
    title: "Take Halda with you",
    desc: "Link SMS so your guide is one text away.",
    stage: "Apply",
    xp: 40,
    done: (p) => p.channelsLinked.includes("sms"),
  },
];

export const BADGES: Record<string, { name: string; desc: string; icon: string }> = {
  b_first_steps: { name: "First Steps", desc: "Met Halda", icon: "sparkles" },
  b_star_mapper: { name: "Star Mapper", desc: "Lit your first constellation", icon: "stars" },
  b_dreamer: { name: "Dreamer", desc: "Added a reach school", icon: "rocket" },
  b_planner: { name: "Planner", desc: "Built a balanced list", icon: "list-checks" },
  b_on_a_roll: { name: "On a Roll", desc: "3-day streak", icon: "flame" },
  b_always_on: { name: "Always-On", desc: "Linked SMS", icon: "smartphone" },
  b_wordsmith: { name: "Wordsmith", desc: "Started an essay", icon: "pen-line" },
};

// Recompute auto-completed quests after a profile update; return newly finished.
export function reconcileQuests(p: StudentProfile): {
  newlyDone: Quest[];
  xpGained: number;
} {
  const newlyDone: Quest[] = [];
  for (const q of QUESTS) {
    if (!p.completedQuests.includes(q.id) && q.done(p)) {
      p.completedQuests.push(q.id);
      newlyDone.push(q);
    }
  }
  const xpGained = newlyDone.reduce((s, q) => s + q.xp, 0);
  p.xp += xpGained;
  return { newlyDone, xpGained };
}

export function questProgress(p: StudentProfile): { done: number; total: number } {
  return {
    done: QUESTS.filter((q) => p.completedQuests.includes(q.id)).length,
    total: QUESTS.length,
  };
}
