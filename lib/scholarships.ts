import type { StudentProfile } from "./types";
import { SCHOLARSHIPS, type ScholarshipEntry } from "./scholarships.data";

// Profile-aware scholarship surfacing. Real, well-known scholarships (cached in
// scholarships.data.ts) scored against what we actually know about the student —
// plus the personalized basics (FAFSA, state aid, department money). Honest by
// construction: award terms change, so the agent always says to verify on the site.
export interface Scholarship {
  name: string;
  amount?: string;
  url?: string;
  why: string; // plain-language reason it fits this student
}

const STEM = /comput|engineer|math|physic|chem|\bbio|science|data|tech|robot|cyber/i;
const HEALTH = /nurs|health|pre-?med|medic|dental|pharm|therap/i;
const BUSINESS = /business|finance|econ|account|marketing|entrepre/i;
const ARTS = /art|design|film|music|theat|anim|fashion|media|writ|photo/i;

function majorTags(major?: string): string[] {
  if (!major) return [];
  const t: string[] = [];
  if (STEM.test(major)) t.push("stem");
  if (/engineer/i.test(major)) t.push("engineering");
  if (HEALTH.test(major)) t.push("health", "nursing");
  if (BUSINESS.test(major)) t.push("business");
  if (ARTS.test(major)) t.push("arts");
  return t;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isInternational = (p: StudentProfile) =>
  !!p.country && !/^(u\.?s\.?a?|united states|america)$/i.test(p.country.trim());

// Why this catalog scholarship fits — lead with the strongest matched reason.
function whyFor(s: ScholarshipEntry, p: StudentProfile, major?: string): string {
  const bits: string[] = [];
  if (s.firstGen && p.firstGen) bits.push("made for first-gen students like you");
  if (s.needBased && p.needsAid) bits.push("need-based, and you said money's a factor");
  if (s.majors?.length && major) bits.push(`for ${major} students`);
  if (s.states?.length && p.state && s.states.includes(p.state)) bits.push(`${p.state}-only, so less competition`);
  if (!bits.length) bits.push(s.blurb);
  const timing = p.grade && p.grade < 12 ? " Apply senior year — worth planning for now." : "";
  return `${cap(bits[0])} — ${s.amount}.${timing}`;
}

export function findScholarships(p: StudentProfile): Scholarship[] {
  const major = p.intendedMajors[0] || p.interestSignals[0]?.interest;
  const tags = majorTags(major);
  const gpa = p.gpa ? parseFloat(p.gpa) : undefined;

  // Personalized basics first — always relevant, always real.
  const basics: Scholarship[] = [];
  if (p.internationalAidNeed || isInternational(p))
    basics.push({ name: "International student aid at each target school", why: `${p.country ? `Applying from ${p.country}` : "International status"} changes aid rules — check need-aware admission, merit aid, and I-20 funding proof school by school.` });
  if (p.needsAid && !isInternational(p))
    basics.push({ name: "Federal aid via FAFSA (incl. Pell Grant)", amount: "up to ~$7,400/yr", why: "You said money's a factor — the FAFSA is the front door to grants you don't pay back. File it senior fall." });
  if (p.isTransfer)
    basics.push({ name: "Transfer student scholarships", why: "You are bringing college credit, so each target school's transfer office may have awards and articulation guarantees for incoming transfers." });
  if (p.worksFullTime)
    basics.push({ name: "Adult learner and workforce scholarships", why: "Working full time can unlock completion grants, employer tuition benefits, and flexible-degree scholarships." });
  if (p.state)
    basics.push({ name: `${p.state} state grants & promise programs`, why: `Staying in ${p.state} unlocks state-only aid you won't find nationally.` });

  // Score the real catalog against the profile.
  const scored = SCHOLARSHIPS.map((s) => {
    let score = 1;
    if (s.needBased && p.needsAid) score += 3;
    if (s.firstGen && p.firstGen) score += 3;
    if (s.majors?.length) score += s.majors.some((m) => tags.includes(m)) ? 3 : -4; // major-specific but not theirs → drop
    if (s.states?.length) score += p.state && s.states.includes(p.state) ? 4 : -6; // other state → exclude
    if (s.merit && gpa != null && gpa >= 3.5) score += 1;
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const matched: Scholarship[] = scored.slice(0, 5).map(({ s }) => ({ name: s.name, amount: s.amount, url: s.url, why: whyFor(s, p, major) }));

  // Dept money is a reliable catch-all when we know a major.
  const dept: Scholarship[] = major ? [{ name: `${cap(major)} department scholarships`, why: `Most schools set aside money specifically for ${major} students — ask each one.` }] : [];

  // Dedupe by name, basics first.
  const seen = new Set<string>();
  return [...basics, ...matched, ...dept].filter((s) => (seen.has(s.name) ? false : seen.add(s.name))).slice(0, 6);
}
