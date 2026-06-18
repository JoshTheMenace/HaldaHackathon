import { SCHOOLS } from "./schools";
import { RMP_RATINGS } from "./ratings.data";

// ─────────────────────────────────────────────────────────────────────────────
// Real RateMyProfessor school-level ratings — what students say about each
// college. Data is fetched ONCE and cached in ratings.data.ts (see
// scripts/fetch-rmp.mjs); the app never calls RMP at request time.
//
// RMP has no official API and this is against their ToS, so it's a demo-only
// source — for production, swap the cache for a licensed feed; this file's shape
// and ratingFor() stay the same.
// ─────────────────────────────────────────────────────────────────────────────

export interface RmpRating {
  schoolId: string;
  rmpId: string; // RMP GraphQL node id (provenance)
  rmpName: string; // the school name as it appears on RMP (verification)
  source: "ratemyprofessors";
  fetchedAt: string; // ISO date the cache was built
  overall: number; // aggregate student rating, 0–5
  reviewCount: number; // number of school-level ratings
  // the 11 categories students score, each 0–5
  reputation: number;
  opportunities: number; // career opportunities
  happiness: number; // overall satisfaction
  social: number; // social activities
  safety: number;
  location: number;
  facilities: number; // campus condition
  clubs: number; // clubs & events
  food: number;
  internet: number;
  library: number;
}

// Human labels for the category keys, for the UI to iterate over.
export const RATING_CATEGORIES: { key: keyof RmpRating; label: string }[] = [
  { key: "reputation", label: "Reputation" },
  { key: "opportunities", label: "Career opportunities" },
  { key: "happiness", label: "Happiness" },
  { key: "social", label: "Social life" },
  { key: "safety", label: "Safety" },
  { key: "location", label: "Location" },
  { key: "facilities", label: "Facilities" },
  { key: "clubs", label: "Clubs & events" },
  { key: "food", label: "Food" },
  { key: "internet", label: "Internet" },
  { key: "library", label: "Library" },
];

export const ratingFor = (schoolId: string): RmpRating | undefined => RMP_RATINGS[schoolId];

// Compact label, e.g. "4.4 ★ · 1,760 reviews".
export function ratingSummary(r: RmpRating): string {
  return `${r.overall.toFixed(1)} ★ · ${r.reviewCount.toLocaleString()} reviews`;
}

// The categories where this school clearly shines (≥ 4.3), strongest first —
// handy for a "students love it for…" UI without dumping all 11 bars.
export function ratingStrengths(r: RmpRating, min = 4.3, limit = 3): { label: string; score: number }[] {
  return RATING_CATEGORIES
    .map((c) => ({ label: c.label, score: r[c.key] as number }))
    .filter((c) => c.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Safety check used by the test below: every seeded school has a cached rating.
export const schoolsMissingRatings = (): string[] => SCHOOLS.filter((s) => !RMP_RATINGS[s.id]).map((s) => s.id);
