// Admissions evaluator — system prompt, student formatter, and Halda translator.
// Ported from the Flask app's judge.py.

import type { StudentProfile as HaldaProfile } from "@/lib/types";

export const MODEL = "claude-haiku-4-5";

export function buildSystemPrompt(college: Record<string, unknown>): string {
  return `You are the admissions committee for ${college["name"]}.

INSTITUTIONAL PROFILE:
${JSON.stringify(college, null, 2)}

YOUR ROLE:
Evaluate student applications exactly as this school's real admissions committee would, based on the institutional profile above. Your evaluation must reflect this specific school's published admission factors, selectivity data, class profile, and stated mission — not a generic framework.

EVALUATION PROCESS — follow this order:
1. Read the student's high_school profile first. Use committee_context and gpa_adjustment to calibrate how you read the GPA and course rigor — a 3.7 at a high-poverty school with 8 AP offerings is a fundamentally different signal than a 3.7 at an elite private school. Apply this lens throughout.
2. Work through each factor in admission_factors starting with "Very Important", then "Important", then "Considered". For each, compare the student's actual numbers and context to the school's published benchmarks and percentile ranges.
3. Assess extracurricular depth and institutional fit — does this student reflect the kind of person this school actively seeks?
4. Weigh holistic context: upward grade trends, demonstrated hardship, first-gen status, geographic diversity, and unusual circumstances, weighted as this specific school would weight them.
5. For incomplete profiles (juniors, missing SAT, unwritten essays), project trajectory and note explicitly what is unknown and how it affects your confidence.
6. Identify the student's application narrative — the single clearest identity signal a committee member would write on the folder after reading. Is it coherent and memorable, or scattered?
7. Then and only then, assign scores.

SCORING RULES:
- Overall score: integer 0–100 in multiples of 5 (e.g. 55, 60, 65 — never 57 or 63)
- Score represents estimated admission likelihood for this specific student at this specific school given what is known
- Score breakdown subcategories: also integers 0–100 in multiples of 5
- Be calibrated: a score of 80+ means genuinely likely admitted; 30 means a long shot

OUTPUT FORMAT:
Respond with valid JSON only — no text before or after the JSON block. Use exactly this structure:
{
  "college": "${college["name"]}",
  "score": <integer, multiple of 5>,
  "tier": "<Strong Admit | Likely | Competitive | Reach | Long Shot | Very Unlikely>",
  "score_breakdown": {
    "academic_fit": <integer 0-100, multiple of 5>,
    "test_scores": <integer 0-100, multiple of 5>,
    "extracurriculars": <integer 0-100, multiple of 5>,
    "essays_and_personal": <integer 0-100, multiple of 5>,
    "holistic_factors": <integer 0-100, multiple of 5>
  },
  "strengths": [
    {"headline": "<bold 8-12 word headline>", "detail": "<one supporting sentence>"},
    {"headline": "...", "detail": "..."}
  ],
  "concerns": [
    {"headline": "<bold 8-12 word headline>", "detail": "<one sentence>"},
    {"headline": "...", "detail": "..."}
  ],
  "what_to_improve": [
    {"action": "<imperative 8-12 word action>", "detail": "<one sentence>"},
    {"action": "...", "detail": "..."}
  ],
  "committee_note": "<One paragraph (4-6 sentences) in the voice of a senior admissions officer>",
  "profile_completeness": "<complete | projected | incomplete>",
  "application_narrative": "<A single phrase (8-15 words) capturing how this committee would mentally file this applicant>",
  "committee_decision": "<One sentence in the committee's voice explaining the core reason for this score>",
  "narrative_coherence": {
    "score": <integer 0-100, multiple of 5>,
    "label": "<Strong | Clear | Mixed | Scattered>",
    "note": "<One sentence on the key narrative strength or gap>"
  },
  "confidence": <integer 0-95, multiple of 5>,
  "confidence_note": "<One sentence explaining the primary driver of confidence or uncertainty>"
}`;
}

export function formatStudent(student: unknown): string {
  return `STUDENT APPLICATION:\n${JSON.stringify(student, null, 2)}`;
}

const GRADE_TO_YEAR: Record<number, string> = {
  9: "freshman",
  10: "sophomore",
  11: "junior",
  12: "senior",
};

export function translateHaldaProfile(
  halda: HaldaProfile,
  seniors: Record<string, unknown>[],
  seniorFill: boolean
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  let fillSource: string | null = null;

  if (seniorFill && seniors.length > 0) {
    base = JSON.parse(JSON.stringify(seniors[Math.floor(Math.random() * seniors.length)]));
    fillSource = (base.name as string) ?? null;
  }

  const name = halda.name || (base.name as string) || "Demo Student";
  const year = GRADE_TO_YEAR[halda.grade ?? 0] ?? (base.year as string) ?? "junior";

  const baseDemographics = (base.demographics as Record<string, unknown>) ?? {};
  const demographics: Record<string, unknown> = { ...baseDemographics };
  if (halda.state) demographics.state = halda.state;
  if (halda.city || halda.state)
    demographics.hometown = [halda.city, halda.state].filter(Boolean).join(", ");
  if (halda.firstGen != null) demographics.first_gen = halda.firstGen;
  if (halda.needsAid != null)
    demographics.financial_need = halda.needsAid ? "high" : "low";
  if (!demographics.citizenship) demographics.citizenship = "US Citizen";

  const academic = { ...((base.academic as Record<string, unknown>) ?? {}) };
  if (halda.highSchool && !academic.school_name) academic.school_name = halda.highSchool;

  const activities = [...((base.activities as unknown[]) ?? [])];
  if (!activities.length) {
    for (const sig of (halda.interestSignals ?? []).slice(0, 6)) {
      if (["serious_extracurricular", "career_path", "major"].includes(sig.intent)) {
        activities.push({
          name: sig.interest.charAt(0).toUpperCase() + sig.interest.slice(1),
          role: "Participant",
          years: 1,
          hours_per_week: 3,
          weeks_per_year: 30,
          description: `${sig.interest} — ${sig.intent.replace(/_/g, " ")} (${sig.importance} importance)`,
          awards: [],
        });
      }
    }
  }

  const majors = halda.intendedMajors ?? [];
  const intendedMajor =
    majors[0] ?? (base.intended_major as string) ?? "Undecided";
  const intendedCareer =
    halda.careerGoal ?? (base.intended_career as string) ?? "";

  const highSchool = { ...((base.high_school as Record<string, unknown>) ?? {}) };
  if (halda.highSchool) highSchool.name = halda.highSchool;
  if (halda.state && !highSchool.state) highSchool.state = halda.state;

  const credits = halda.creditWallet ?? [];
  const creditNote = credits.length
    ? "Credits from Halda: " + credits.slice(0, 8).map((c) => c.source).join(", ")
    : "";
  const additional = [creditNote, (base.additional_info as string) ?? ""]
    .filter(Boolean)
    .join("\n");

  return {
    name,
    slug: "halda_student",
    archetype: "Halda Import" + (seniorFill ? " + Demo Fill" : ""),
    year,
    profile_completeness: seniorFill ? "complete" : "projected",
    demographics,
    academic,
    test_scores: { ...((base.test_scores as Record<string, unknown>) ?? {}) },
    activities,
    intended_major: intendedMajor,
    intended_major_alt: (base.intended_major_alt as string) ?? "",
    intended_career: intendedCareer,
    essays: { ...((base.essays as Record<string, unknown>) ?? { main_essay_quality: "not_yet_written" }) },
    high_school: highSchool,
    hooks: (base.hooks as unknown[]) ?? [],
    additional_info: additional,
    _halda_sourced: true,
    _fill_source: fillSource,
  };
}
