import type { StudentProfile } from "./types";
import { titleCase } from "./match";

// ─────────────────────────────────────────────────────────────────────────────
// Cohort = the student's Class-of community, scoped to THEIR pathway. Seeded
// peers + posts stand in for a real cohort, but everything the student SEES
// (their pathway label, cohort size, the schools being compared, which posts
// surface first) is derived live from their real profile.
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortPeer {
  id: string;
  name: string; // first name + last initial only (privacy)
  avatar: string;
  pathway: string;
}

export interface CohortPost {
  id: string;
  authorId: string; // a peer id, or "halda" for the pinned system post
  pathway: string;
  time: string;
  body: string;
  tags: string[];
  likes: number;
  comments: number;
  system?: boolean;
  pinned?: boolean;
}

// A couple of seeded community members (the "couple of user profiles" we seed).
export const COHORT_PEERS: CohortPeer[] = [
  { id: "p_jordan", name: "Jordan L.", avatar: "https://i.pravatar.cc/80?img=32", pathway: "Nursing & Health" },
  { id: "p_priya", name: "Priya S.", avatar: "https://i.pravatar.cc/80?img=45", pathway: "Nursing & Health" },
  { id: "p_marcus", name: "Marcus B.", avatar: "https://i.pravatar.cc/80?img=12", pathway: "Health Sciences" },
  { id: "p_ava", name: "Ava T.", avatar: "https://i.pravatar.cc/80?img=5", pathway: "Computer Science" },
  { id: "p_diego", name: "Diego R.", avatar: "https://i.pravatar.cc/80?img=15", pathway: "Engineering" },
  { id: "p_lily", name: "Lily M.", avatar: "https://i.pravatar.cc/80?img=20", pathway: "Biology & Life Sciences" },
];

export const peerById = (id: string) => COHORT_PEERS.find((p) => p.id === id);

export const COHORT_POSTS: CohortPost[] = [
  {
    id: "post_jordan", authorId: "p_jordan", pathway: "Nursing & Health", time: "2h ago",
    body: "Just got the UVU Nursing Grant for first-gen students 🎉 The Halda guide walked me through every form. If anyone's nervous about the essay, happy to share what I wrote.",
    tags: ["Scholarship", "FirstGen", "UVU"], likes: 64, comments: 9,
  },
  {
    id: "post_priya", authorId: "p_priya", pathway: "Nursing & Health", time: "5h ago",
    body: "Anyone else taking the TEAS before winter break? Starting a study group on Saturdays at the Orem library — we have 4 so far. Comment if you want in.",
    tags: ["StudyGroup", "TEAS", "Local"], likes: 27, comments: 18,
  },
  {
    id: "post_marcus", authorId: "p_marcus", pathway: "Health Sciences", time: "1d ago",
    body: "FAFSA question — do I list my parent's income if they're self-employed? Not sure which line. Any tips appreciated 🙏",
    tags: ["FAFSA", "Question"], likes: 11, comments: 23,
  },
  {
    id: "post_ava", authorId: "p_ava", pathway: "Computer Science", time: "3h ago",
    body: "Built my first portfolio site this weekend! If you're applying CS, a GitHub with even one real project goes a long way. Happy to review anyone's.",
    tags: ["CompSci", "Portfolio", "Question"], likes: 41, comments: 7,
  },
  {
    id: "post_diego", authorId: "p_diego", pathway: "Engineering", time: "6h ago",
    body: "Reminder the PSAT is coming up — it's the qualifier for National Merit. Khan Academy's free practice actually helped me jump 120 points.",
    tags: ["PSAT", "Study"], likes: 33, comments: 5,
  },
  {
    id: "post_lily", authorId: "p_lily", pathway: "Biology & Life Sciences", time: "8h ago",
    body: "Touring the U of U biology labs next Friday for anyone local — they let sophomores shadow a research group. Ask your counselor's office to sign up.",
    tags: ["Biology", "Local", "Tour"], likes: 19, comments: 12,
  },
];

// The student's pathway, derived from their real major / strongest interest.
export function pathwayFor(p: StudentProfile): string {
  const m = (p.intendedMajors[0] || p.interestSignals[0]?.interest || "").toLowerCase();
  if (!m) return "";
  if (/nurs|pre-?med|medic|health/.test(m)) return "Nursing & Health";
  if (/comput|software|coding|\bcs\b|program|data|\bai\b|machine learning/.test(m)) return "Computer Science";
  if (/engineer/.test(m)) return "Engineering";
  if (/bio|life scien|ecolog|marine/.test(m)) return "Biology & Life Sciences";
  if (/business|finance|econ|account|marketing|entrepre/.test(m)) return "Business";
  if (/art|design|film|music|theat|anim|fashion|media/.test(m)) return "Arts & Design";
  return titleCase(m);
}

// Short chip label for the pathway, e.g. "Nursing & Health" → "Nursing".
export const pathwayShort = (pathway: string) => pathway.split(/[&]/)[0].trim().split(" ")[0];

// Believable cohort size for a pathway label (seeded, stable).
export function cohortSize(pathway: string): number {
  const base: Record<string, number> = {
    "Nursing & Health": 248, "Computer Science": 312, "Engineering": 196,
    "Biology & Life Sciences": 174, "Business": 220, "Arts & Design": 143, "Health Sciences": 168,
  };
  return base[pathway] ?? 180;
}

// Peer faces for the banner — on-pathway first, padded with others.
export function cohortFaces(pathway: string): CohortPeer[] {
  const on = COHORT_PEERS.filter((p) => p.pathway === pathway);
  const rest = COHORT_PEERS.filter((p) => p.pathway !== pathway);
  return [...on, ...rest].slice(0, 4);
}

// Posts ranked for this student: same-pathway first, then broadly useful ones.
export function postsFor(p: StudentProfile): CohortPost[] {
  const path = pathwayFor(p);
  const broad = /FAFSA|Scholarship|PSAT|Question/;
  const score = (post: CohortPost) => (post.pathway === path ? 2 : broad.test(post.tags.join()) ? 1 : 0);
  return [...COHORT_POSTS].sort((a, b) => score(b) - score(a) || b.likes - a.likes);
}
