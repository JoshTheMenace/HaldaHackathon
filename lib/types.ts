// ─────────────────────────────────────────────────────────────────────────────
// Halda core domain types. The data model is deliberately split by TENANT:
//   • Student data lives under a studentId and is never exposed wholesale.
//   • Schools (university partners) are a separate tenant that can only see a
//     MASKED marketplace view until they purchase a named, consented profile.
// ─────────────────────────────────────────────────────────────────────────────

export type Channel = "web" | "sms" | "email" | "voice";

// The winning idea: match a student's LIFE INTERESTS (with intent) to schools
// where those interests can become identity, community, career, and opportunity.
export type InterestIntent =
  | "career_path"
  | "major"
  | "serious_extracurricular"
  | "community"
  | "fan_culture"
  | "personal_hobby";

export type Importance = "low" | "medium" | "high" | "must_have";

export interface InterestSignal {
  interest: string; // "soccer", "film", "animation", "music"…
  intent: InterestIntent; // what they actually want from it
  importance: Importance;
  evidenceQuote?: string; // what the student said, verbatim-ish
  source?: "voice" | "text" | "manual";
}

export type ProfileField =
  | "name"
  | "grade"
  | "location"
  | "interests"
  | "major"
  | "setting"
  | "size"
  | "budget"
  | "goal";

// Tasks & deadlines the agent (or student) tracks — e.g. "File the FAFSA".
export type TaskKind = "deadline" | "todo" | "milestone";
export interface TaskItem {
  id: string;
  title: string;
  detail?: string;
  due?: string; // ISO date
  kind: TaskKind;
  status: "open" | "done";
  source: "halda" | "manual";
  key?: string; // canonical key, e.g. "fafsa"
}

// AP / dual-enrollment / IB credit the student has or plans — "where will my
// high-school work actually count?" Drives the creditTransferFit ranking lens.
export type CreditStatus = "completed" | "taking" | "planned" | "considering";
export type CreditSourceType = "ap" | "dual_enrollment" | "ib" | "honors" | "clep";
export interface CreditItem {
  id: string;
  source: string; // "AP Biology", "Concurrent Enrollment Math 1050"
  type: CreditSourceType;
  subject: string; // "science","writing","math","social science"…
  status: CreditStatus;
  score?: string; // "A", "4", "unknown"
  note?: string; // potential value
}

export interface StudentProfile {
  id: string;
  // Identity (captured naturally in conversation)
  name?: string;
  zip?: string;
  city?: string;
  state?: string;
  highSchool?: string;
  grade?: number; // 9-12; sophomore = 10
  // What Halda learns over time
  interests: string[]; // e.g. ["coding", "robotics", "art"]
  interestSignals: InterestSignal[]; // rich, intent-classified interests
  intendedMajors: string[]; // e.g. ["Computer Science"]
  careerGoal?: string;
  settingPref?: "city" | "suburban" | "rural" | "any";
  sizePref?: "small" | "medium" | "large" | "any";
  maxBudget?: number; // net price / yr the family can manage
  needsAid?: boolean;
  stayInState?: boolean; // wants to stay in-state / close to home
  firstGen?: boolean;
  // Academic / activity enrichment surfaced on the Profile screen
  gpa?: string; // "3.85"
  testType?: string; // "ACT" | "SAT"
  testScore?: string; // "29"
  serviceHours?: number;
  serviceFocus?: string;
  lettersConfirmed?: number;
  lettersTotal?: number;
  transcriptStatus?: string;
  scholarships?: { applied: number; won: number; rejected: number; pending: number };
  extracurriculars?: string[];
  checklistDone?: number;
  checklistTotal?: number;
  savedSchoolIds?: string[]; // schools the student swiped right / saved
  trackedSchools?: { id: string; label?: string; status: "review" | "draft" | "action" | "saved" }[];
  // Engagement / gamification
  tasks: TaskItem[];
  creditWallet: CreditItem[];
  xp: number;
  streak: number;
  completedQuests: string[];
  badges: string[];
  channelsLinked: Channel[];
  // Consent — schools only ever receive fields the student opted to share
  consent: { fields: ProfileField[]; shareWithPartners: boolean };
  createdAt: number;
  updatedAt: number;
}

export interface School {
  id: string;
  name: string;
  short: string;
  city: string;
  state: string;
  region: "West" | "Southwest" | "Midwest" | "South" | "Northeast";
  setting: "city" | "suburban" | "rural";
  size: "small" | "medium" | "large";
  acceptanceRate: number; // 0-1
  netPrice: number; // avg net price / yr after aid
  strongMajors: string[];
  vibe: string;
  accent: string; // brand color for the school chip
  // Partner economics (shown in the university portal)
  partner: boolean;
  cpl: number; // cost-per-lead the school pays Halda for a purchased profile
}

export type FitDimension =
  | "major"
  | "distance"
  | "size"
  | "setting"
  | "affordability"
  | "selectivity";

export interface FitBreakdown {
  dimension: FitDimension;
  score: number; // 0-100
  label: string;
}

export interface Match {
  schoolId: string;
  fit: number; // 0-100 overall
  breakdown: FitBreakdown[];
  reasons: string[]; // human "why this fits you"
  reach: "safety" | "target" | "reach";
}

export type LeadStatus = "matched" | "purchased";

// What a SCHOOL sees in the marketplace. Identity is masked until purchase.
export interface Lead {
  id: string;
  schoolId: string;
  studentId: string;
  fit: number;
  reach: "safety" | "target" | "reach";
  status: LeadStatus;
  // Masked summary (always visible to the school)
  masked: {
    initials: string;
    gradeLabel: string; // "Sophomore"
    region: string; // "Austin, TX area"
    distanceMi: number;
    intent: string[]; // ["Computer Science", "Robotics"]
    engagement: string; // "Active · 6-day streak"
    fitBlurb: string;
  };
  // Revealed only after purchase, and only for consented fields
  revealed?: {
    name: string;
    highSchool?: string;
    grade?: number;
    intendedMajors: string[];
    interests: string[];
    careerGoal?: string;
    contact: { channel: Channel; handle: string };
  };
  purchasedAt?: number;
}

export type Role = "halda" | "student" | "system";

// A visible "the agent is doing something" line in the chat (function calls).
export type ToolKind = "search" | "scholarship" | "task" | "profile" | "school";
export interface ToolEvent {
  kind: ToolKind;
  label: string; // "Searching right-fit schools"
  detail?: string; // "4 matches" / "FAFSA added"
  items?: { title: string; sub?: string }[]; // optional result cards (e.g. scholarships)
  schools?: { schoolId: string; matchPct: number }[]; // search results → interactive cards
}

export interface ChatMessage {
  id: string;
  role: Role;
  channel: Channel;
  text: string;
  ts: number;
  // UI hooks for the gamified feel
  reward?: { xp: number; quest?: string; badge?: string; field?: ProfileField };
  chips?: string[]; // quick-reply suggestions
  typing?: boolean;
  tool?: ToolEvent; // when set, render as a tool-call chip, not a chat bubble
}
