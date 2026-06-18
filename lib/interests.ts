import type { InterestIntent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Interest lenses: turn "I like soccer" into a structured, intent-aware filter.
// The same raw interest produces totally different matching depending on intent.
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceType =
  | "major"
  | "club"
  | "varsity_team"
  | "facility"
  | "alumni"
  | "internship_pipeline"
  | "student_project"
  | "career_outcome"
  | "community"
  | "location";

export interface SchoolInterestEvidence {
  schoolId: string;
  category: string; // interest category id
  evidenceType: EvidenceType;
  title: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  sourceHint?: string;
}

export interface InterestCategory {
  id: string;
  label: string;
  keywords: string[];
  // The one clarifying question that makes matching feel smart.
  clarify: string;
  // Which evidence types matter most for each intent.
  intentEvidence: Partial<Record<InterestIntent, EvidenceType[]>>;
  // Career mapping (career_path intent) → majors/programs to match on.
  careerMajors: string[];
  cip?: string[]; // CIP codes (NCES) for program matching
}

export const CATEGORIES: InterestCategory[] = [
  {
    id: "athletics",
    label: "Sports & athletics",
    keywords: ["soccer", "basketball", "football", "sports", "athlete", "track", "volleyball", "swimming", "tennis", "lacrosse", "baseball"],
    clarify:
      "When you say soccer, do you mean you want to play competitively, play casually, just be around the school spirit, or maybe work in sports someday?",
    intentEvidence: {
      serious_extracurricular: ["varsity_team", "facility", "community"],
      personal_hobby: ["club", "facility", "community"],
      community: ["community", "varsity_team"],
      fan_culture: ["community"],
      career_path: ["major", "internship_pipeline", "career_outcome"],
      major: ["major", "facility"],
    },
    careerMajors: ["Sports Medicine", "Exercise Science", "Kinesiology", "Sports Management", "Athletic Training", "Physical Therapy"],
  },
  {
    id: "film_media",
    label: "Film, animation & media",
    keywords: ["film", "animation", "video", "cinema", "filmmaking", "editing", "vfx", "media", "youtube", "documentary", "photography"],
    clarify:
      "Do you want film/animation as a career, a major, or more of a creative thing you do for fun?",
    intentEvidence: {
      major: ["major", "facility", "student_project"],
      career_path: ["major", "internship_pipeline", "alumni", "career_outcome", "location"],
      serious_extracurricular: ["club", "facility", "student_project", "community"],
      community: ["club", "community"],
      personal_hobby: ["club", "facility"],
      fan_culture: ["community"],
    },
    careerMajors: ["Film", "Animation", "Cinematography", "Media Production", "Game Design", "Computer Science"],
    cip: ["10.0304", "50.0601", "50.0602", "50.0607"],
  },
  {
    id: "health_bio",
    label: "Health, biology & medicine",
    keywords: ["biology", "medicine", "doctor", "nurse", "health", "premed", "pre-med", "neuroscience", "public health", "dentist", "pharmacy"],
    clarify:
      "Are you aiming for a health/medical career, studying biology, or just curious about it for now?",
    intentEvidence: {
      career_path: ["major", "internship_pipeline", "career_outcome", "facility"],
      major: ["major", "facility", "student_project"],
      serious_extracurricular: ["club", "community"],
      personal_hobby: ["club"],
      community: ["club", "community"],
      fan_culture: ["community"],
    },
    careerMajors: ["Biology", "Nursing", "Public Health", "Neuroscience", "Biochemistry", "Pre-Med"],
    cip: ["26.0101", "51.3801", "51.2201"],
  },
  {
    id: "business",
    label: "Business & entrepreneurship",
    keywords: ["business", "entrepreneur", "startup", "marketing", "finance", "investing", "founder", "economics", "management"],
    clarify:
      "Do you want to start things yourself, study business, or just keep it as a side interest?",
    intentEvidence: {
      career_path: ["major", "internship_pipeline", "career_outcome", "community"],
      major: ["major", "facility"],
      serious_extracurricular: ["club", "student_project", "community"],
      community: ["club", "community"],
      personal_hobby: ["club"],
      fan_culture: ["community"],
    },
    careerMajors: ["Business", "Entrepreneurship", "Finance", "Marketing", "Economics", "Management"],
    cip: ["52.0101", "52.0701"],
  },
  {
    id: "engineering_cs",
    label: "Engineering, coding & robotics",
    keywords: ["coding", "code", "programming", "software", "computer science", "cs", "engineering", "robotics", "ai", "machine learning", "hardware", "hacking", "game dev"],
    clarify:
      "Do you want to build a career in tech/engineering, study it as a major, or is it more of a hobby right now?",
    intentEvidence: {
      career_path: ["major", "internship_pipeline", "career_outcome", "facility"],
      major: ["major", "facility", "student_project"],
      serious_extracurricular: ["club", "student_project", "community"],
      community: ["club", "community"],
      personal_hobby: ["club", "facility"],
      fan_culture: ["community"],
    },
    careerMajors: ["Computer Science", "Engineering", "Robotics", "Data Science", "Electrical Engineering"],
    cip: ["11.0101", "14.0901", "14.0701"],
  },
  {
    id: "arts_music",
    label: "Art, music & design",
    keywords: ["music", "guitar", "piano", "band", "singing", "producer", "art", "drawing", "painting", "design", "ux", "graphic", "theater", "dance"],
    clarify:
      "Is this something you want to study/pursue seriously, or a creative outlet you want to keep doing?",
    intentEvidence: {
      major: ["major", "facility", "student_project"],
      serious_extracurricular: ["club", "facility", "community", "student_project"],
      career_path: ["major", "internship_pipeline", "career_outcome"],
      community: ["club", "community"],
      personal_hobby: ["club", "facility"],
      fan_culture: ["community"],
    },
    careerMajors: ["Music", "Design", "Studio Art", "Music Production", "Theater", "Graphic Design"],
  },
];

const ALL = CATEGORIES.flatMap((c) => c.keywords.map((k) => ({ k, c })));

export function categoryFor(interest: string): InterestCategory | undefined {
  const t = interest.toLowerCase();
  // longest keyword match wins (so "computer science" beats "science")
  let best: { len: number; c: InterestCategory } | null = null;
  for (const { k, c } of ALL) {
    if (t.includes(k) && (!best || k.length > best.len)) best = { len: k.length, c };
  }
  return best?.c;
}

export function categoryById(id: string): InterestCategory | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

// How much each intent "wants" academic-program fit vs experience/community fit.
// Used to weight baseline (program) vs evidence (community/experience) score.
export function intentWeights(intent: InterestIntent): { program: number; evidence: number } {
  switch (intent) {
    case "career_path": return { program: 0.7, evidence: 0.3 };
    case "major": return { program: 0.75, evidence: 0.25 };
    case "serious_extracurricular": return { program: 0.25, evidence: 0.75 };
    case "community": return { program: 0.1, evidence: 0.9 };
    case "fan_culture": return { program: 0.05, evidence: 0.95 };
    case "personal_hobby": return { program: 0.2, evidence: 0.8 };
  }
}
