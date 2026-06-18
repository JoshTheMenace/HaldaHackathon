// Halda's persona + the structured-extraction contract, shared by the text chat
// route and the voice (Live) transcript extractor — one brain, every channel.

export const HALDA_SYSTEM = `You are Halda, an always-on AI college guide for HIGH-SCHOOL students — most are SOPHOMORES (15-16). You text like a warm, sharp older sibling who already survived the college process: encouraging, honest, lightly playful, never a stiff guidance counselor. Short messages, ONE question at a time, plain language, occasional emoji.

It is currently 2026; use 2026 whenever you need the current year.

YOUR MISSION: don't just collect GPA + major. Learn what the student actually CARES about and turn each interest into a path, a community, and a future. When a student names an interest (soccer, film, animation, music, business, coding…), figure out the INTENT behind it, because "I like soccer" can mean five different things:
- career_path (wants to work in/around it)
- major (wants to study it)
- serious_extracurricular (wants to do it competitively/seriously)
- community (wants the culture/people/belonging)
- fan_culture (loves watching/being around it)
- personal_hobby (just enjoys it casually)
If the intent is ambiguous, ask ONE friendly clarifying question — e.g. "when you say soccer, do you mean you want to play competitively, play casually, be around the school spirit, or maybe work in sports someday?" That single question makes you feel way smarter than a search box.

Naturally capture, over the conversation: name, grade, location (city/ZIP), interests (with intent + importance), intended major(s), career goals, campus setting/size preference, money reality (budget / needs aid), transfer context, international context, and target schools they want to compare. Never make the student fill a form — get it through talking.

OUTPUT: Always respond with ONLY valid JSON (no markdown fences) matching exactly:
{
  "reply": "your warm conversational message to the student",
  "updates": {
    "name"?: string,
    "grade"?: number,           // 9-12; sophomore = 10
    "city"?: string, "state"?: string, "zip"?: string,
    "intendedMajors"?: string[],
    "careerGoal"?: string,
    "settingPref"?: "city"|"suburban"|"rural"|"any",
    "sizePref"?: "small"|"medium"|"large"|"any",
    "maxBudget"?: number,       // net price/yr the family can manage
    "needsAid"?: boolean,
    "stayInState"?: boolean,    // true if they want to stay in-state / close to home (also save "state")
    "isTransfer"?: boolean,
    "worksFullTime"?: boolean,
    "currentCollege"?: string,
    "completedCollegeYears"?: number,
    "associateDegree"?: string,
    "transferCreditsConcern"?: boolean,
    "country"?: string,
    "visaNeed"?: boolean,
    "internationalAidNeed"?: boolean,
    "targetSchools"?: string[],
    "interestSignals"?: [
      { "interest": string, "intent": "career_path"|"major"|"serious_extracurricular"|"community"|"fan_culture"|"personal_hobby", "importance": "low"|"medium"|"high"|"must_have", "evidenceQuote": string }
    ]
  }
}
Only include fields in "updates" you actually learned THIS turn (omit unknowns — don't guess). For interestSignals, include the student's own words in evidenceQuote. Keep "reply" to 1-3 sentences and end with one question unless you're wrapping up.`;

export interface ProfileUpdates {
  name?: string;
  email?: string;
  phone?: string;
  grade?: number;
  highSchool?: string;
  city?: string;
  state?: string;
  zip?: string;
  firstGen?: boolean;
  intendedMajors?: string[];
  careerGoal?: string;
  settingPref?: "city" | "suburban" | "rural" | "any";
  sizePref?: "small" | "medium" | "large" | "any";
  maxBudget?: number;
  needsAid?: boolean;
  stayInState?: boolean;
  isTransfer?: boolean;
  worksFullTime?: boolean;
  currentCollege?: string;
  completedCollegeYears?: number;
  associateDegree?: string;
  transferCreditsConcern?: boolean;
  country?: string;
  visaNeed?: boolean;
  internationalAidNeed?: boolean;
  targetSchools?: string[];
  gpa?: string;
  testType?: string;
  testScore?: string;
  chosenSchools?: string[];
  interestSignals?: {
    interest: string;
    intent: string;
    importance: string;
    evidenceQuote?: string;
  }[];
  creditItems?: {
    source: string;
    type: string;
    subject: string;
    status: string;
    score?: string;
    note?: string;
  }[];
}

export interface HaldaReply {
  reply: string;
  updates: ProfileUpdates;
  nextQuestion?: string;
}

// Compact profile summary so the model has memory of what it already knows.
export function profileSummary(p: {
  name?: string; email?: string; phone?: string; age?: number; language?: string; grade?: number; city?: string; state?: string; zip?: string; highSchool?: string;
  intendedMajors?: string[]; settingPref?: string; sizePref?: string;
  needsAid?: boolean; maxBudget?: number; careerGoal?: string; stayInState?: boolean;
  isTransfer?: boolean; worksFullTime?: boolean; currentCollege?: string; completedCollegeYears?: number; associateDegree?: string; transferCreditsConcern?: boolean;
  country?: string; visaNeed?: boolean; internationalAidNeed?: boolean; targetSchools?: string[];
  gpa?: string; testType?: string; testScore?: string;
  interestSignals?: { interest: string; intent: string; importance: string }[];
  creditWallet?: { source: string; status: string; score?: string }[];
  savedSchoolIds?: string[];
  trackedSchools?: { id: string; label?: string; status: string }[];
}): string {
  const parts: string[] = [];
  if (p.name) parts.push(`name=${p.name}`);
  if (p.email) parts.push(`email=${p.email}`);
  if (p.phone) parts.push(`phone=${p.phone}`);
  if (p.age) parts.push(`age=${p.age}`);
  if (p.language === "es") parts.push("language=Spanish; reply in Spanish");
  if (p.grade) parts.push(`grade=${p.grade}`);
  if (p.highSchool) parts.push(`highSchool=${p.highSchool}`);
  if (p.city || p.state || p.zip) parts.push(`location=${[p.city, p.state].filter(Boolean).join(", ")}${p.zip ? ` ${p.zip}` : ""}`);
  if (p.gpa) parts.push(`gpa=${p.gpa}`);
  if (p.testScore) parts.push(`${p.testType || "test"}=${p.testScore}`);
  if (p.intendedMajors?.length) parts.push(`majors=${p.intendedMajors.join("/")}`);
  if (p.careerGoal) parts.push(`goal=${p.careerGoal}`);
  if (p.settingPref) parts.push(`setting=${p.settingPref}`);
  if (p.sizePref) parts.push(`size=${p.sizePref}`);
  if (p.needsAid) parts.push("needsAid=true");
  if (p.stayInState) parts.push("stayInState=true");
  if (p.maxBudget) parts.push(`budget=${p.maxBudget}`);
  if (p.isTransfer) parts.push("isTransfer=true");
  if (p.worksFullTime) parts.push("worksFullTime=true");
  if (p.currentCollege) parts.push(`currentCollege=${p.currentCollege}`);
  if (p.completedCollegeYears) parts.push(`completedCollegeYears=${p.completedCollegeYears}`);
  if (p.associateDegree) parts.push(`associateDegree=${p.associateDegree}`);
  if (p.transferCreditsConcern) parts.push("transferCreditsConcern=true");
  if (p.country) parts.push(`country=${p.country}`);
  if (p.visaNeed) parts.push("visaNeed=true");
  if (p.internationalAidNeed) parts.push("internationalAidNeed=true");
  if (p.targetSchools?.length) parts.push(`targetSchools=${p.targetSchools.join("/")}`);
  if (p.interestSignals?.length)
    parts.push("interests=" + p.interestSignals.map((s) => `${s.interest}(${s.intent},${s.importance})`).join("; "));
  if (p.creditWallet?.length)
    parts.push("credits=" + p.creditWallet.map((c) => `${c.source}${c.score ? ` (${c.score})` : ""} [${c.status}]`).join("; "));
  if (p.savedSchoolIds?.length) parts.push(`chosenSchools=${p.savedSchoolIds.join("/")}`);
  if (p.trackedSchools?.length) parts.push("trackedSchools=" + p.trackedSchools.map((s) => `${s.label || s.id}(${s.status})`).join("; "));
  return parts.length ? `KNOWN SO FAR: ${parts.join(" · ")}` : "KNOWN SO FAR: nothing yet";
}
