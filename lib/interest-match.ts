import type { Match, School, StudentProfile } from "./types";
import { SCHOOLS, schoolById } from "./schools";
import { scoreSchool } from "./match";
import { categoryFor, intentWeights, type SchoolInterestEvidence } from "./interests";
import { evidenceFor } from "./evidence";
import { creditTransferFit, type CreditFit } from "./credit";
import { ratingFor, type RmpRating } from "./ratings";

// ─────────────────────────────────────────────────────────────────────────────
// Interest-aligned matching. Layers on top of the baseline (location/cost/size)
// score: for each of the student's intent-classified interests, we score how
// well a school lets that interest become a path/community/career, backed by
// concrete evidence badges. Explainable by construction.
// ─────────────────────────────────────────────────────────────────────────────

const CONF_W = { high: 1, medium: 0.7, low: 0.45 } as const;
const IMP_W = { must_have: 1, high: 0.8, medium: 0.55, low: 0.3 } as const;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface InterestAlignedSchoolScore {
  schoolId: string;
  overallFit: number;
  baselineFit: number;
  interestFit: number;
  evidenceFit: number;
  affordabilityFit: number;
  scholarshipFit: number;
  creditFit: CreditFit;
  rating?: RmpRating; // real RateMyProfessor student feedback (undefined if uncached)
  reasons: string[];
  concerns: string[];
  nextQuestions: string[];
  evidenceBadges: SchoolInterestEvidence[];
  perInterest: {
    interest: string;
    intent: string;
    fit: number;
    badges: SchoolInterestEvidence[];
  }[];
  reach: Match["reach"];
}

function programMatch(school: School, careerMajors: string[]): number {
  const strong = school.strongMajors.map((m) => m.toLowerCase());
  let best = 0;
  for (const cm of careerMajors) {
    const c = cm.toLowerCase();
    for (const s of strong) {
      if (s.includes(c) || c.includes(s)) best = Math.max(best, 100);
      else if (s.split(/\W+/).some((t) => t.length > 3 && c.includes(t))) best = Math.max(best, 70);
    }
  }
  return best;
}

function evidenceScore(badges: SchoolInterestEvidence[], wantedTypes: string[]): number {
  if (!badges.length) return 0;
  let score = 0;
  for (const b of badges) {
    const typeBonus = wantedTypes.includes(b.evidenceType) ? 1 : 0.5;
    score += CONF_W[b.confidence] * typeBonus * 22;
  }
  return Math.min(100, score);
}

export function scoreInterestFit(
  p: StudentProfile,
  school: School
): InterestAlignedSchoolScore {
  const baseline = scoreSchool(p, school);
  // If the student only named a major (no explicit interests), treat it as an
  // implied "major" interest so the interest/evidence/credit lenses still fire.
  const signals =
    (p.interestSignals?.length ? p.interestSignals : null) ??
    p.intendedMajors.map((m) => ({ interest: m, intent: "major" as const, importance: "high" as const }));

  const perInterest: InterestAlignedSchoolScore["perInterest"] = [];
  const reasons: string[] = [];
  const concerns: string[] = [];
  const nextQuestions: string[] = [];
  const allBadges: SchoolInterestEvidence[] = [];

  let weightedFit = 0;
  let weightSum = 0;

  for (const sig of signals) {
    const cat = categoryFor(sig.interest);
    if (!cat) continue;
    const w = intentWeights(sig.intent);
    const wantedTypes = cat.intentEvidence[sig.intent] ?? [];
    const badges = evidenceFor(school.id, cat.id).filter(
      (b) => wantedTypes.length === 0 || wantedTypes.includes(b.evidenceType) || b.confidence === "high"
    );
    const prog = programMatch(school, cat.careerMajors);
    const evid = evidenceScore(badges, wantedTypes);
    const fit = clamp(prog * w.program + evid * w.evidence);

    const imp = IMP_W[sig.importance];
    weightedFit += fit * imp;
    weightSum += imp;

    perInterest.push({ interest: sig.interest, intent: sig.intent, fit, badges: badges.slice(0, 3) });
    allBadges.push(...badges);

    if (fit >= 70 && badges[0])
      reasons.push(`Great for ${sig.interest}: ${badges[0].title}.`);
    else if (fit >= 60 && prog >= 70)
      reasons.push(`Strong fit for ${sig.interest} — it's one of their better programs.`);
    if (sig.importance === "must_have" && fit < 55)
      concerns.push(`You said ${cap(sig.interest)} is a must-have, but we found thin evidence here.`);
    if (sig.importance === "low" || !sig.intent)
      nextQuestions.push(cat.clarify);
  }

  const interestFit = weightSum ? clamp(weightedFit / weightSum) : 0;
  const evidenceFit = clamp(
    (allBadges.reduce((s, b) => s + CONF_W[b.confidence], 0) / Math.max(1, allBadges.length)) * 100
  );
  const baselineFit = baseline.fit;
  const dim = (d: string) => baseline.breakdown.find((b) => b.dimension === d)?.score ?? 65;
  const affordabilityFit = dim("affordability");
  const academicFit = dim("major");
  const familyFit = Math.round((dim("distance") + dim("setting") + dim("size")) / 3);
  const scholarshipFit = clamp(110 - (school.netPrice / 30000) * 60);
  const creditFit = creditTransferFit(p, school);
  for (const c of creditFit.cautions) concerns.push(c);

  // 6-factor explainable score (per the product spec), with dynamic weighting:
  // a cost-sensitive student leans harder on credit + scholarship; a student who
  // wants one thing "no matter what" leans into interest.
  let w = { academic: 0.2, interest: 0.2, afford: 0.2, scholarship: 0.15, credit: 0.15, family: 0.1 };
  const costSensitive = p.needsAid === true || (p.maxBudget != null && p.maxBudget <= 22000);
  const atAllCosts = signals.some((x) => x.importance === "must_have" && (x.intent === "major" || x.intent === "career_path"));
  if (costSensitive) w = { academic: 0.175, interest: 0.175, afford: 0.2, scholarship: 0.2, credit: 0.2, family: 0.05 };
  if (atAllCosts) w = { ...w, interest: w.interest + 0.1, credit: Math.max(0.05, w.credit - 0.05), scholarship: Math.max(0.05, w.scholarship - 0.05) };
  const wSum = w.academic + w.interest + w.afford + w.scholarship + w.credit + w.family;
  const blended =
    (academicFit * w.academic + interestFit * w.interest + affordabilityFit * w.afford +
      scholarshipFit * w.scholarship + creditFit.score * w.credit + familyFit * w.family) / wSum;
  let overallFit = signals.length ? clamp(blended) : baselineFit;

  // "Stay close to home" preference: strongly float in-state schools up and push
  // out-of-state ones down, so the list honors what the student actually asked for.
  if (p.stayInState && p.state) {
    const home = school.state === p.state;
    overallFit = clamp(overallFit + (home ? 6 : -26));
    if (home) reasons.unshift(`Stays close to home in ${p.state} — and in-state tuition keeps the price down.`);
  }

  // Fold a couple of baseline reasons in for color.
  for (const r of baseline.reasons.slice(0, 2)) if (reasons.length < 4) reasons.push(r);

  return {
    schoolId: school.id,
    overallFit,
    baselineFit,
    interestFit,
    evidenceFit,
    affordabilityFit,
    scholarshipFit,
    creditFit,
    rating: ratingFor(school.id),
    reasons: dedupe(reasons).slice(0, 4),
    concerns: dedupe(concerns).slice(0, 2),
    nextQuestions: dedupe(nextQuestions).slice(0, 2),
    evidenceBadges: rankBadges(allBadges).slice(0, 6),
    perInterest,
    reach: baseline.reach,
  };
}

export function rankInterestMatches(p: StudentProfile, limit = 6): InterestAlignedSchoolScore[] {
  return SCHOOLS.map((s) => scoreInterestFit(p, s))
    .sort((a, b) => b.overallFit - a.overallFit)
    .slice(0, limit);
}

function rankBadges(b: SchoolInterestEvidence[]): SchoolInterestEvidence[] {
  const seen = new Set<string>();
  return [...b]
    .sort((x, y) => CONF_W[y.confidence] - CONF_W[x.confidence])
    .filter((e) => { const k = e.title + e.category; if (seen.has(k)) return false; seen.add(k); return true; });
}

const dedupe = (a: string[]) => [...new Set(a)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function prettyIntent(i: string): string {
  return ({ career_path: "career", major: "major", serious_extracurricular: "serious", community: "community", fan_culture: "fan", personal_hobby: "hobby" } as Record<string, string>)[i] || i;
}

export { schoolById };
