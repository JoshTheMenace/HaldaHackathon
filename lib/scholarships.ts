import type { StudentProfile } from "./types";

// Lightweight, profile-aware scholarship surfacing. Not a live database — a set
// of honest, well-known options matched to what we know about the student, so a
// "find scholarships" tool call has real, relevant results to show.
export interface Scholarship {
  name: string;
  why: string; // plain-language reason it fits this student
}

export function findScholarships(p: StudentProfile): Scholarship[] {
  const out: Scholarship[] = [];
  const major = p.intendedMajors[0] || p.interestSignals[0]?.interest;

  if (p.needsAid)
    out.push({ name: "Federal aid via FAFSA (incl. Pell Grant)", why: "You said money's a factor — the FAFSA is the front door to grants you don't pay back." });
  if (p.firstGen)
    out.push({ name: "First-gen scholarships (e.g. I'm First, Coca-Cola Scholars)", why: "Being first in your family to go to college opens up scholarships made for exactly that." });
  if (p.state)
    out.push({ name: `${p.state} state grants & promise programs`, why: `Staying in ${p.state} means you can tap state-only aid like promise scholarships.` });
  if (major)
    out.push({ name: `${cap(major)} department scholarships`, why: `Many schools have money set aside specifically for ${major} students.` });

  // Always include a broad merit option so there's never an empty result.
  out.push({ name: "National Merit (via the PSAT junior year)", why: "Do well on the PSAT next year and you're in the running for merit aid — worth prepping for." });

  return out.slice(0, 4);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
