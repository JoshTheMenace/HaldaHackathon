import type { ProfileField, StudentProfile } from "./types";
import { FIELD_XP } from "./gamify";
import { rankMatches, titleCase } from "./match";
import { schoolById } from "./schools";
import { resolveZip } from "./geo";

// ─────────────────────────────────────────────────────────────────────────────
// Halda's brain. A deterministic slot-filling + intent engine that feels alive
// with ZERO external API. It (1) extracts everything a student volunteers,
// (2) acknowledges it warmly and specifically, (3) asks the next best question,
// and (4) answers off-script questions helpfully. The SAME engine runs on web,
// SMS, and email — that's the multi-channel thesis in code.
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentTurn {
  text: string;
  chips?: string[];
  reward?: { xp: number; field?: ProfileField; badge?: string };
  patch: Partial<StudentProfile>;
  learned: ProfileField[];
  revealMatches?: boolean;
}

interface InterestDef {
  match: string[];
  interest: string;
  major?: string;
}

const INTERESTS: InterestDef[] = [
  { match: ["coding", "code", "programming", "program", "software", "developer", "python", "javascript", "app dev", "apps"], interest: "Coding", major: "Computer Science" },
  { match: ["robot", "robotics", "arduino", "mechatronic"], interest: "Robotics", major: "Engineering" },
  { match: ["game dev", "gamedev", "game design", "video game", "gaming", "games"], interest: "Game Design", major: "Computer Science" },
  { match: ["ai", "machine learning", "ml", "artificial intelligence"], interest: "AI", major: "Computer Science" },
  { match: ["art", "drawing", "painting", "illustration", "sketch"], interest: "Art", major: "Design" },
  { match: ["design", "ux", "ui", "graphic"], interest: "Design", major: "Design" },
  { match: ["music", "guitar", "piano", "band", "singing", "producer", "beats"], interest: "Music", major: "Music" },
  { match: ["writing", "poetry", "journalism", "stories", "novel", "essays"], interest: "Writing", major: "Journalism" },
  { match: ["biology", "bio", "medicine", "doctor", "nurse", "health", "premed", "pre-med"], interest: "Health & Bio", major: "Biology" },
  { match: ["business", "entrepreneur", "startup", "marketing", "finance"], interest: "Business", major: "Business" },
  { match: ["math", "calculus", "mathematics", "numbers"], interest: "Math", major: "Mathematics" },
  { match: ["environment", "climate", "sustainability", "ecology", "nature"], interest: "Environment", major: "Environmental Science" },
  { match: ["psychology", "psych", "the mind", "human behavior"], interest: "Psychology", major: "Psychology" },
  { match: ["engineering", "engineer", "mechanical", "build things", "building things"], interest: "Engineering", major: "Engineering" },
  { match: ["space", "aerospace", "astronomy", "rockets", "nasa"], interest: "Space", major: "Aerospace" },
  { match: ["film", "video", "photography", "photo", "cinema", "editing"], interest: "Film & Media", major: "Film" },
  { match: ["sports", "basketball", "soccer", "football", "track", "athlete", "swimming"], interest: "Sports" },
  { match: ["architecture", "buildings", "architect"], interest: "Architecture", major: "Architecture" },
];

const MAJOR_ALIASES: Record<string, string> = {
  cs: "Computer Science",
  "computer science": "Computer Science",
  "comp sci": "Computer Science",
  engineering: "Engineering",
  business: "Business",
  biology: "Biology",
  "pre-med": "Biology",
  premed: "Biology",
  nursing: "Nursing",
  design: "Design",
  psychology: "Psychology",
  aerospace: "Aerospace",
  "game design": "Computer Science",
  architecture: "Architecture",
  journalism: "Journalism",
  music: "Music",
  mathematics: "Mathematics",
};

const STATES: Record<string, string> = {
  texas: "TX", california: "CA", arizona: "AZ", colorado: "CO", georgia: "GA",
  washington: "WA", massachusetts: "MA", "new york": "NY", michigan: "MI",
  indiana: "IN", florida: "FL", illinois: "IL",
};

const GREETINGS = new Set(["hi", "hey", "hello", "yo", "sup", "hiya", "heya"]);
const NAME_STOP = new Set([
  "a", "an", "really", "into", "not", "so", "good", "fine", "ok", "okay",
  "yeah", "yes", "no", "sure", "cool", "the", "im", "i", "just", "here",
  "thanks", "idk", "umm", "um", "well", "maybe", "guess",
]);

// strip leading/trailing non-letters ("Maya!" -> "Maya")
const clean = (w: string) => w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");

// pseudo-variety that's deterministic per turn (demo-stable, no hydration drama)
const pick = <T,>(arr: T[], turn: number): T => arr[turn % arr.length];

// word-boundary keyword test so "art" doesn't match "start" or "physics"→"cs"
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, kw: string) =>
  new RegExp(`\\b${esc(kw)}\\b`, "i").test(text);

function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Extraction ────────────────────────────────────────────────────────────────

function extractName(text: string): string | undefined {
  const m = text.match(
    /(?:i'?m|i am|my name is|it'?s|this is|call me|name'?s)\s+([A-Za-z][A-Za-z'-]{1,20})/i
  );
  if (m) {
    const c = clean(m[1]);
    if (c && !NAME_STOP.has(c.toLowerCase())) return cap(c.toLowerCase());
  }
  const words = text.trim().split(/\s+/).map(clean).filter(Boolean);
  if (words.length >= 1 && words.length <= 2) {
    const w = words[0];
    const lw = w.toLowerCase();
    if (
      /^[A-Za-z][A-Za-z'-]{1,20}$/.test(w) &&
      !GREETINGS.has(lw) &&
      !NAME_STOP.has(lw)
    )
      return cap(lw);
  }
  return undefined;
}

function extractGrade(text: string): number | undefined {
  const t = text.toLowerCase();
  if (/\b(soph|sophomore|10th|grade 10|10 th|tenth)\b/.test(t)) return 10;
  if (/\b(fresh|freshman|9th|grade 9|ninth)\b/.test(t)) return 9;
  if (/\b(junior|11th|grade 11|eleventh)\b/.test(t)) return 11;
  if (/\b(senior|12th|grade 12|twelfth)\b/.test(t)) return 12;
  return undefined;
}

function extractLocation(text: string): { zip?: string; state?: string; city?: string } {
  const out: { zip?: string; state?: string; city?: string } = {};
  const zip = text.match(/\b(\d{5})\b/);
  if (zip) {
    out.zip = zip[1];
    const r = resolveZip(zip[1]);
    if (r?.city) out.city = r.city;
    if (r?.state) out.state = r.state;
  }
  const t = text.toLowerCase();
  for (const [name, abbr] of Object.entries(STATES)) {
    if (t.includes(name)) out.state = abbr;
  }
  const stAbbr = text.match(/\b([A-Z]{2})\b/);
  if (!out.state && stAbbr && Object.values(STATES).includes(stAbbr[1]))
    out.state = stAbbr[1];
  const city = text.match(/\b(?:in|from|near)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  if (city) out.city = city[1];
  return out;
}

function extractInterests(text: string): { interests: string[]; majors: string[] } {
  const interests = new Set<string>();
  const majors = new Set<string>();
  for (const def of INTERESTS) {
    if (def.match.some((k) => hasWord(text, k))) {
      interests.add(def.interest);
      if (def.major) majors.add(def.major);
    }
  }
  return { interests: [...interests], majors: [...majors] };
}

function extractMajor(text: string): string | undefined {
  for (const [alias, canon] of Object.entries(MAJOR_ALIASES)) {
    if (hasWord(text, alias)) return canon;
  }
  return undefined;
}

function extractSetting(text: string): StudentProfile["settingPref"] | undefined {
  const t = text.toLowerCase();
  if (/\b(city|urban|downtown|big city)\b/.test(t)) return "city";
  if (/\b(suburb|suburban|town)\b/.test(t)) return "suburban";
  if (/\b(rural|countryside|small town|quiet)\b/.test(t)) return "rural";
  if (/\b(anywhere|don'?t care|no preference|whatever)\b/.test(t)) return "any";
  return undefined;
}

function extractSize(text: string): StudentProfile["sizePref"] | undefined {
  const t = text.toLowerCase();
  if (/\b(big|large|huge|tons of people)\b/.test(t)) return "large";
  if (/\b(medium|mid|in between|balanced)\b/.test(t)) return "medium";
  if (/\b(small|tiny|intimate|close-knit)\b/.test(t)) return "small";
  if (/\b(anywhere|don'?t care|no preference|whatever)\b/.test(t)) return "any";
  return undefined;
}

function extractMoney(text: string): { maxBudget?: number; needsAid?: boolean } {
  const t = text.toLowerCase();
  const out: { maxBudget?: number; needsAid?: boolean } = {};
  const dollar = t.match(/\$?\s?(\d{1,3})(?:\s?k|,?000)/);
  if (dollar) out.maxBudget = parseInt(dollar[1], 10) * 1000;
  if (/\b(aid|scholarship|need.*money|can'?t afford|tight|low.?income|fafsa|help paying)\b/.test(t))
    out.needsAid = true;
  if (/\b(money.?s not|cost.?s? not|don'?t worry about (cost|money))\b/.test(t))
    out.maxBudget = 60000;
  return out;
}

// ── Slot plan: the order Halda guides a new student through ──────────────────────

interface Slot {
  field: ProfileField;
  filled: (p: StudentProfile) => boolean;
  ask: string[];
  chips?: string[];
}

const SLOTS: Slot[] = [
  {
    field: "name",
    filled: (p) => !!p.name,
    ask: ["First things first — what should I call you? 😊"],
  },
  {
    field: "grade",
    filled: (p) => !!p.grade,
    ask: [
      "Love it. What grade are you in right now?",
      "Nice to meet you! What year are you — freshman, sophomore…?",
    ],
    chips: ["Freshman", "Sophomore", "Junior", "Senior"],
  },
  {
    field: "location",
    filled: (p) => !!(p.zip || p.state),
    ask: [
      "And where are you based? A city or ZIP works — it helps me find schools near you. 📍",
      "Where do you call home? City or ZIP is perfect.",
    ],
  },
  {
    field: "interests",
    filled: (p) => p.interests.length >= 2,
    ask: [
      "Okay, the fun part — what are you actually into? Classes, hobbies, things you lose track of time doing. ⚡",
      "What lights you up? Could be a subject, a hobby, anything.",
    ],
    chips: ["Coding 💻", "Art 🎨", "Robotics 🤖", "Business 📈", "Biology 🧬", "Music 🎸"],
  },
  {
    field: "major",
    filled: (p) => p.intendedMajors.length >= 1,
    ask: [
      "If you had to bet on a major today (totally changeable!), what feels right?",
      "Any major you're leaning toward? No pressure — it's a starting point.",
    ],
    chips: ["Computer Science", "Engineering", "Business", "Not sure yet"],
  },
  {
    field: "setting",
    filled: (p) => !!p.settingPref,
    ask: [
      "Picture your campus: big city energy, chill suburb, or quiet small town?",
    ],
    chips: ["Big city", "Suburban", "Small town", "Anywhere"],
  },
  {
    field: "size",
    filled: (p) => !!p.sizePref,
    ask: ["And the vibe — small and close-knit, huge with everything, or in between?"],
    chips: ["Small", "Medium", "Large", "No preference"],
  },
  {
    field: "budget",
    filled: (p) => !!p.maxBudget || p.needsAid === true,
    ask: [
      "Real talk so my matches actually help — should I prioritize affordability and scholarships?",
    ],
    chips: ["Yes, find me aid 💸", "Budget ~$20k/yr", "Cost isn't a worry"],
  },
];

// ── Acknowledgements: specific, warm, a little playful ───────────────────────────

function ackFor(field: ProfileField, p: StudentProfile, turn: number): string {
  switch (field) {
    case "name":
      return pick([`${p.name}! Love that name. 🎉`, `Awesome — hey ${p.name}! 👋`], turn);
    case "grade": {
      const label = gradeLabel(p.grade!);
      return p.grade === 10
        ? pick([
            `A sophomore — honestly the perfect time to start. Most people wait till senior year and stress out. You're ahead. 🙌`,
            `Sophomore year! You're starting early, which is exactly how you end up with options instead of regrets.`,
          ], turn)
        : `Got it — ${label}. Plenty of runway to build something great.`;
    }
    case "location": {
      const where = p.city || p.state || "there";
      return pick([`${where} — nice. I'll keep distance in mind. 📍`, `Cool, ${where}! Noted.`], turn);
    }
    case "interests": {
      const list = p.interests.slice(0, 3).join(", ");
      return pick([
        `${list} — that's a great mix. I can already feel some schools forming. ✨`,
        `Ooh, ${list}. Tells me a lot already.`,
      ], turn);
    }
    case "major": {
      const m = p.intendedMajors[0];
      return pick([`${m} — solid. Some schools genuinely punch above their weight here. 🎯`, `${m} it is. I know exactly which programs to look at.`], turn);
    }
    case "setting":
      return `${cap(p.settingPref!)} campus — noted. 🏙️`;
    case "size":
      return `${cap(p.sizePref!)} it is.`;
    case "budget":
      return p.needsAid
        ? `Got it — I'll hunt for aid and surface your best net prices, not sticker prices. 💸`
        : `Perfect, that helps me keep matches realistic.`;
    case "goal":
      return `Love that. I'll remember it. 💭`;
    default:
      return "Got it.";
  }
}

function gradeLabel(g: number): string {
  return { 9: "freshman", 10: "sophomore", 11: "junior", 12: "senior" }[g] || `grade ${g}`;
}

// ── Off-script question handling ────────────────────────────────────────────────

function maybeAnswerQuestion(p: StudentProfile, text: string): string | undefined {
  const t = text.toLowerCase();

  // The memory callback — a signature "it actually knows me" moment.
  if (/\b(remember|forget|memory|memorize|keep track|how do you know)\b/.test(t)) {
    const bits = [
      p.intendedMajors[0] && `${p.intendedMajors[0]} intent`,
      p.city && `home base in ${p.city}`,
      p.needsAid && "needing aid",
    ].filter(Boolean);
    return `that's kind of my whole thing 😄 everything you tell me, I keep — so you never start over. right now I've got: ${
      bits.length ? bits.join(", ") : "the basics"
    }. it's why I work way better than Googling.`;
  }
  if (/\b(scholarship|aid|afford|expensive|cost|money|fafsa|net price|the money)\b/.test(t)) {
    const cheapest = rankMatches(p, 4).map((m) => schoolById(m.schoolId)!)
      .sort((a, b) => a.netPrice - b.netPrice)[0];
    return `the number that actually matters is net price (after aid), not the scary sticker price.${
      cheapest ? ` example: ${cheapest.short} runs about $${cheapest.netPrice.toLocaleString()}/yr net for someone like you.` : ""
    } i only ever show you schools that work for your budget. 💸`;
  }
  if (/\b(essay|write|story|application|apply|deadline)\b/.test(t)) {
    return `love that you're thinking ahead. once your matches are up, "Start my essay" is right there and we'll bank a story only you could tell — junior-you will thank you.`;
  }
  if (/\b(reach|safety|target|chances|get in)\b/.test(t)) {
    return `I sort every match into reach / target / safety so your list stays balanced — you always want all three. that's how you end up with options, not regrets.`;
  }
  if (/\b(who are you|what are you|what is halda|what do you do)\b/.test(t)) {
    return `I'm Halda — your college guide. I learn what you're about over time and turn it into a real plan: right-fit schools, scholarships, essays, deadlines. and I'm one text away, always. 🤝`;
  }

  const isQuestion = /\?$/.test(text.trim()) || /\b(what|which|how|should|why|recommend|best|top|where)\b/.test(t);
  if (isQuestion && /\b(best|good|recommend|top|which school|where should|fit)\b/.test(t)) {
    const top = rankMatches(p, 3);
    if (top.length && top[0].fit >= 50) {
      const names = top.map((m) => schoolById(m.schoolId)?.short).filter(Boolean);
      return `from what I know so far, I'd look hard at ${names.join(", ")}. want the why behind each, or the money details first?`;
    }
    return `I can give you a killer shortlist — just need a couple more things first. mind if I ask?`;
  }
  return undefined;
}

// ── Main entry ───────────────────────────────────────────────────────────────

export function haldaOpener(): string {
  return "Hey! I'm Halda 👋 Think of me as your personal college guide — I'll learn what you're into and help you find schools that actually fit. This takes about 2 minutes and it's kind of fun. Ready?";
}

export function respond(
  profile: StudentProfile,
  userText: string,
  turn: number,
  alreadyRevealed = false
): AgentTurn {
  const patch: Partial<StudentProfile> = {};
  const learned: ProfileField[] = [];

  const expecting = SLOTS.find((s) => !s.filled(profile))?.field;

  // 1) Extract everything volunteered (prioritize the expected slot for name).
  if (!profile.name && (expecting === "name" || extractName(userText))) {
    const n = extractName(userText);
    if (n) { patch.name = n; learned.push("name"); }
  }
  const g = extractGrade(userText);
  if (g && !profile.grade) { patch.grade = g; learned.push("grade"); }

  const loc = extractLocation(userText);
  if ((loc.zip || loc.state) && !(profile.zip || profile.state)) {
    if (loc.zip) patch.zip = loc.zip;
    if (loc.state) patch.state = loc.state;
    if (loc.city) patch.city = loc.city;
    learned.push("location");
  }

  const { interests, majors } = extractInterests(userText);
  if (interests.length) {
    const merged = Array.from(new Set([...profile.interests, ...interests]));
    if (merged.length !== profile.interests.length) {
      patch.interests = merged;
      if (!learned.includes("interests")) learned.push("interests");
    }
    if (majors.length && profile.intendedMajors.length === 0) {
      patch.intendedMajors = Array.from(new Set(majors)).slice(0, 1);
      learned.push("major");
    }
  }
  const explicitMajor = extractMajor(userText);
  if (explicitMajor && (patch.intendedMajors?.length ?? profile.intendedMajors.length) === 0) {
    patch.intendedMajors = [explicitMajor];
    if (!learned.includes("major")) learned.push("major");
  }

  if (expecting === "setting" || /\b(city|urban|suburb|rural|small town|anywhere)\b/i.test(userText)) {
    const s = extractSetting(userText);
    if (s && !profile.settingPref) { patch.settingPref = s; learned.push("setting"); }
  }
  if (expecting === "size" || /\b(small|medium|large|big|tiny)\b/i.test(userText)) {
    const sz = extractSize(userText);
    if (sz && !profile.sizePref) { patch.sizePref = sz; learned.push("size"); }
  }
  const money = extractMoney(userText);
  if ((money.maxBudget || money.needsAid) && !(profile.maxBudget || profile.needsAid)) {
    if (money.maxBudget) patch.maxBudget = money.maxBudget;
    if (money.needsAid) patch.needsAid = money.needsAid;
    learned.push("budget");
  }

  // Apply patch to a working copy so we can pick the next question correctly.
  const working: StudentProfile = { ...profile, ...patch,
    interests: patch.interests ?? profile.interests,
    intendedMajors: patch.intendedMajors ?? profile.intendedMajors };

  // 2) Build the reply.
  const parts: string[] = [];
  let reward: AgentTurn["reward"] | undefined;
  if (learned.length) {
    parts.push(ackFor(learned[0], working, turn));
    const xp = learned.reduce((s, f) => s + (FIELD_XP[f] || 0), 0);
    reward = { xp, field: learned[0] };
  }

  // 3) Off-script question? Answer it, then nudge forward.
  const answer = learned.length ? undefined : maybeAnswerQuestion(working, userText);
  if (answer) parts.push(answer);

  // 4) Next question — or reveal matches once we know enough.
  const nextSlot = SLOTS.find((s) => !s.filled(working));
  let revealMatches = false;
  let chips: string[] | undefined;

  // Core profile incl. money — the reveal is the climax, so it waits for it.
  const coreReady =
    !!working.name &&
    !!working.grade &&
    !!(working.zip || working.state) &&
    working.interests.length >= 2 &&
    working.intendedMajors.length >= 1 &&
    !!working.settingPref &&
    !!working.sizePref &&
    (!!working.maxBudget || working.needsAid === true || turn >= 9);

  const NEXT_ACTIONS = ["Start my essay ✍️", "Find scholarships 💸", "Build my list 📌"];

  if (coreReady && !alreadyRevealed) {
    parts.push(
      `Okay ${working.name || "friend"} — I've got enough to light up your constellation. ✨ Watch your matches come to life on the dashboard →`
    );
    revealMatches = true;
    chips = NEXT_ACTIONS;
  } else if (nextSlot) {
    if (!answer || learned.length) parts.push(pick(nextSlot.ask, turn));
    chips = nextSlot.chips;
  } else if (alreadyRevealed && !parts.length) {
    parts.push(
      pick(
        [
          "What do you want to dig into next? 🎓",
          "Nice — what's next on your mind?",
        ],
        turn
      )
    );
    chips = NEXT_ACTIONS;
  }

  if (!parts.length) parts.push("Tell me a bit more — I'm listening. 👂");

  return { text: parts.join("\n\n"), chips, reward, patch, learned, revealMatches };
}
