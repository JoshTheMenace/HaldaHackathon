import { SCORECARD_CACHE } from "./scorecard.data";

// ─────────────────────────────────────────────────────────────────────────────
// College Scorecard (api.data.gov) — real, official data for ANY U.S. college.
// Fills the "schools beyond our seeded 17" gap (MIT, Stanford, transfer targets).
// Cache-first (like RateMyProfessor): well-known schools resolve from the bundled
// cache with zero network; the long tail falls back to one live API call (memoized).
// ─────────────────────────────────────────────────────────────────────────────

export interface ScorecardSchool {
  name: string;
  city?: string;
  state?: string;
  acceptanceRate?: number; // 0–1
  netPrice?: number; // avg net price $/yr after aid
  size?: number; // undergrad enrollment
  completionRate?: number; // 0–1
  medianEarnings?: number; // median $ 10yrs after entry
  source: "scorecard";
}

const KEY = process.env.SCORECARD_API_KEY;
const FIELDS = [
  "school.name", "school.city", "school.state",
  "latest.admissions.admission_rate.overall",
  "latest.cost.avg_net_price.overall",
  "latest.student.size",
  "latest.completion.rate_suppressed.overall",
  "latest.earnings.10_yrs_after_entry.median",
].join(",");

const STOP = ["the", "of", "at", "in", "and", "a"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const cacheKey = (s: string) => norm(s).replace(/\b(the|of|at|university|college|in)\b/g, " ").replace(/\s+/g, " ").trim();
const toks = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !STOP.includes(t)));
const initials = (s: string) => norm(s).split(" ").filter((t) => t && !STOP.includes(t)).map((t) => t[0]).join("");
const memo = new Map<string, ScorecardSchool | null>();

// Does a cached school match what the student typed? Exact name, an acronym
// (MIT, UCLA, USC → school initials), or all typed words present — never a loose
// substring (which made "MIT" hit "Mitchell College").
function cacheMatch(typed: string, schoolName: string): boolean {
  const q = cacheKey(typed);
  if (!q) return false;
  if (cacheKey(schoolName) === q) return true;
  if (/^[a-z]{2,5}$/.test(q) && initials(schoolName) === q) return true;
  const qt = toks(typed), st = toks(schoolName);
  return qt.size >= 2 && [...qt].every((t) => st.has(t));
}

// Pick the result that actually matches the query (the live name search is fuzzy).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bestMatch(results: any[], query: string): any {
  const q = norm(query), qt = toks(query);
  const named = results.filter((r) => r["school.name"]);
  for (const r of named) if (norm(r["school.name"]) === q) return r;
  const starts = named.filter((r) => norm(r["school.name"]).startsWith(q));
  if (starts.length) return starts.sort((a, b) => norm(a["school.name"]).length - norm(b["school.name"]).length)[0];
  let best = null, bestScore = -1;
  for (const r of named) {
    const rt = toks(r["school.name"]);
    if ([...qt].filter((t) => rt.has(t)).length / Math.max(1, qt.size) < 1) continue;
    const score = 1 - [...rt].filter((t) => !qt.has(t)).length * 0.08;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapResult(r: any): ScorecardSchool {
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    name: r["school.name"],
    city: r["school.city"] || undefined,
    state: r["school.state"] || undefined,
    acceptanceRate: num(r["latest.admissions.admission_rate.overall"]),
    netPrice: num(r["latest.cost.avg_net_price.overall"]),
    size: num(r["latest.student.size"]),
    completionRate: num(r["latest.completion.rate_suppressed.overall"]),
    medianEarnings: num(r["latest.earnings.10_yrs_after_entry.median"]),
    source: "scorecard",
  };
}

export async function scorecardLookup(name: string): Promise<ScorecardSchool | null> {
  const key = cacheKey(name);
  if (!key) return null;
  // 1) bundled cache (no network) — exact / acronym / all-words
  const hit = SCORECARD_CACHE.find((s) => cacheMatch(name, s.name));
  if (hit) return hit;
  // 2) per-process memo
  if (memo.has(key)) return memo.get(key)!;
  // 3) one live API call, picking the result that actually matches
  if (!KEY) return null;
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?api_key=${KEY}&school.name=${encodeURIComponent(name)}&fields=${FIELDS}&per_page=25`;
    const res = await fetch(url);
    const j = await res.json();
    const r = bestMatch(j?.results ?? [], name);
    const out = r ? mapResult(r) : null;
    memo.set(key, out);
    return out;
  } catch {
    return null;
  }
}
