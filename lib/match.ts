import type {
  FitBreakdown,
  FitDimension,
  Match,
  School,
  StudentProfile,
} from "./types";
import { SCHOOLS } from "./schools";
import { SCHOOL_COORDS, haversineMi, resolveZip } from "./geo";

// Weight each dimension. Major + affordability matter most to a real student.
const WEIGHTS: Record<FitDimension, number> = {
  major: 0.3,
  affordability: 0.22,
  distance: 0.13,
  setting: 0.12,
  size: 0.1,
  selectivity: 0.13,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function majorScore(p: StudentProfile, s: School): number {
  const wants = [...p.intendedMajors, ...p.interests].map((x) =>
    x.toLowerCase()
  );
  if (wants.length === 0) return 60;
  let best = 0;
  for (const m of s.strongMajors) {
    const ml = m.toLowerCase();
    for (const w of wants) {
      if (ml.includes(w) || w.includes(ml)) best = Math.max(best, 100);
      else if (sharesToken(ml, w)) best = Math.max(best, 80);
    }
  }
  return best || 45;
}

function sharesToken(a: string, b: string): boolean {
  const at = new Set(a.split(/\W+/).filter((t) => t.length > 3));
  return b.split(/\W+/).some((t) => t.length > 3 && at.has(t));
}

function affordabilityScore(p: StudentProfile, s: School): number {
  if (!p.maxBudget) return p.needsAid ? aidProxy(s) : 70;
  if (s.netPrice <= p.maxBudget) return 100;
  const over = (s.netPrice - p.maxBudget) / p.maxBudget;
  return clamp(100 - over * 140);
}

// When we only know "needs aid", reward lower net price.
function aidProxy(s: School): number {
  return clamp(110 - (s.netPrice / 30000) * 60);
}

function distanceScore(p: StudentProfile, s: School): { score: number; mi: number } {
  const here = resolveZip(p.zip, p.state);
  const there = SCHOOL_COORDS[s.id];
  if (!here || !there) return { score: 65, mi: 0 };
  const mi = haversineMi(here, there);
  // Close is comfy; very far loses points but never zero (some want far).
  const score = clamp(100 - Math.min(mi, 2600) / 26);
  return { score, mi };
}

function prefScore(pref: string | undefined, actual: string): number {
  if (!pref || pref === "any") return 75;
  return pref === actual ? 100 : 55;
}

function selectivityScore(p: StudentProfile, s: School): number {
  // Without test scores we model "ambition fit": a balanced list wants a mix.
  // Reward mid-selectivity as broadly safe; flag extremes as reach/safety.
  const r = s.acceptanceRate;
  if (r >= 0.55) return 88; // likely
  if (r >= 0.3) return 80; // target-ish
  return 68; // reach
}

function reachOf(s: School): Match["reach"] {
  if (s.acceptanceRate >= 0.55) return "safety";
  if (s.acceptanceRate >= 0.25) return "target";
  return "reach";
}

const DIM_LABEL: Record<FitDimension, string> = {
  major: "Major",
  affordability: "Affordability",
  distance: "Distance",
  setting: "Setting",
  size: "Size",
  selectivity: "Selectivity",
};

export function scoreSchool(p: StudentProfile, s: School): Match {
  const dist = distanceScore(p, s);
  const dims: Record<FitDimension, number> = {
    major: majorScore(p, s),
    affordability: affordabilityScore(p, s),
    distance: dist.score,
    setting: prefScore(p.settingPref, s.setting),
    size: prefScore(p.sizePref, s.size),
    selectivity: selectivityScore(p, s),
  };
  const fit = clamp(
    (Object.keys(dims) as FitDimension[]).reduce(
      (sum, d) => sum + dims[d] * WEIGHTS[d],
      0
    )
  );
  const breakdown: FitBreakdown[] = (Object.keys(dims) as FitDimension[]).map(
    (d) => ({ dimension: d, score: dims[d], label: DIM_LABEL[d] })
  );

  return {
    schoolId: s.id,
    fit,
    breakdown,
    reasons: reasonsFor(p, s, dims, dist.mi),
    reach: reachOf(s),
  };
}

function reasonsFor(
  p: StudentProfile,
  s: School,
  dims: Record<FitDimension, number>,
  mi: number
): string[] {
  const out: string[] = [];
  if (dims.major >= 80) {
    const m =
      p.intendedMajors[0] || p.interests[0] || s.strongMajors[0];
    out.push(`Standout for ${titleCase(m)} — one of its strongest programs.`);
  }
  if (dims.affordability >= 85)
    out.push(`Fits your budget at ~$${s.netPrice.toLocaleString()}/yr net.`);
  if (mi > 0 && dims.distance >= 80)
    out.push(`Only ~${mi} miles from home.`);
  else if (mi > 800) out.push(`A bigger leap — ~${mi} miles away.`);
  if (dims.setting >= 95) out.push(`${titleCase(s.setting)} campus, just how you like it.`);
  if (s.acceptanceRate < 0.2) out.push(`A reach worth stretching for.`);
  if (out.length === 0) out.push(s.vibe);
  return out.slice(0, 3);
}

export function rankMatches(p: StudentProfile, limit = 8): Match[] {
  return SCHOOLS.map((s) => scoreSchool(p, s))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, limit);
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// How "complete" is the profile (drives match confidence + gamification).
export function profileCompleteness(p: StudentProfile): number {
  const checks = [
    !!p.name,
    !!p.grade,
    !!(p.zip || p.state),
    p.interests.length > 0,
    p.intendedMajors.length > 0,
    !!p.settingPref,
    !!p.sizePref,
    !!(p.maxBudget || p.needsAid),
    !!p.careerGoal,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
