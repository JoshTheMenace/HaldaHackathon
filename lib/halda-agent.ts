import { GoogleGenAI, Type } from "@google/genai";
import type { StudentProfile, TaskItem, ToolEvent, School } from "./types";
import { rankInterestMatches, scoreInterestFit } from "./interest-match";
import { schoolById, SCHOOLS } from "./schools";
import { RATING_CATEGORIES, type RmpRating } from "./ratings";
import { makeTask } from "./deadlines";
import { findScholarships } from "./scholarships";
import { resolveZip, stateFromText, stateNameFromText } from "./geo";
import { scorecardLookup } from "./scorecard";
import { profileSummary, type ProfileUpdates } from "./halda-prompt";
import { findVirtualTourVideo } from "./youtube";

// Capture location passively from whatever the student says — a spelled-out
// state, a "stay in X" line, or a ZIP — on EVERY message, not just when they
// set stayInState. Location drives ranking and the web-search filter, so we
// should rarely have it empty. Uses the strict state-name matcher so chat
// filler ("OK", "hi", "in") can't be mistaken for a state; the deliberate
// stayInState path keeps the looser matcher (it can read a bare "UT").
function deriveLocation(working: StudentProfile, updates: ProfileUpdates, message: string, history?: { role: string; text: string }[]) {
  const texts = [message, ...((history ?? []).map((h) => h.text))];
  if (!working.state) {
    const found =
      texts.map(stateNameFromText).find(Boolean) ||
      (working.zip ? resolveZip(working.zip)?.state : undefined) ||
      (working.stayInState ? texts.map(stateFromText).find(Boolean) : undefined);
    if (found) { working.state = found; updates.state = found; }
  }
  if (!working.city && working.zip) {
    const z = resolveZip(working.zip);
    if (z?.city) { working.city = z.city; updates.city = z.city; }
  }
}

// Generic words shared by many school names — matching on these makes EVERY
// "X University" resolve to the first seeded school (the "Pulling up UT Austin"
// bug). Only distinctive tokens (Stanford, Provo, A&M) should match.
const SCHOOL_STOPWORDS = new Set(["university", "college", "the", "of", "at", "in", "and", "state", "institute", "school", "main", "campus", "a"]);

// Resolve a student-typed school name to a seeded school (fuzzy: short, name, tokens).
// Returns undefined for anything not in our 17 (e.g. Stanford) → caller uses Scorecard.
function resolveSchool(q: string): School | undefined {
  const n = q.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (!n) return undefined;
  const distinctive = n.split(" ").filter((w) => w.length > 3 && !SCHOOL_STOPWORDS.has(w));
  return (
    SCHOOLS.find((s) => s.short.toLowerCase() === n || s.name.toLowerCase() === n) ||
    SCHOOLS.find((s) => n.includes(s.short.toLowerCase()) || s.name.toLowerCase().includes(n)) ||
    SCHOOLS.find((s) => distinctive.some((w) => s.name.toLowerCase().includes(w) || s.short.toLowerCase().includes(w)))
  );
}

// Student-life categories that speak to "would I belong here?" — surface the
// ones this school clearly shines at, strongest first.
const BELONGING_KEYS = new Set(["happiness", "social", "clubs", "safety", "location", "facilities"]);
function belongingSignals(r: RmpRating): string[] {
  return RATING_CATEGORIES.filter((c) => BELONGING_KEYS.has(c.key as string) && (r[c.key] as number) >= 4.0)
    .sort((a, b) => (r[b.key] as number) - (r[a.key] as number))
    .slice(0, 3)
    .map((c) => c.label);
}

// The hard facts we DO have, phrased so a web search can filter by them first
// (location/distance, stay-in-state, budget) before going deep on an interest.
function searchConstraints(p: StudentProfile): string {
  const bits: string[] = [];
  const loc = p.city && p.state ? `${p.city}, ${p.state}` : p.state || p.city;
  if (loc) bits.push(`based near ${loc}`);
  if (p.stayInState && p.state) bits.push(`wants to stay in ${p.state} (in-state tuition)`);
  if (p.maxBudget) bits.push(`budget ~$${p.maxBudget.toLocaleString()}/yr after aid`);
  if (p.grade) bits.push(`high-school grade ${p.grade}`);
  if (p.isTransfer) bits.push("transfer applicant; preserve credits");
  if (p.worksFullTime) bits.push("works full time; needs practical/flexible options");
  if (p.country) bits.push(`applying from ${p.country}`);
  if (p.visaNeed) bits.push("needs visa/I-20 support");
  if (p.internationalAidNeed) bits.push("needs aid available to international students");
  return bits.length ? `Filter to fit this student: ${bits.join("; ")}.` : "";
}

// Run a focused, Google-grounded web lookup and return a concise answer + sources.
// General-purpose: campus culture/belonging, program quality for a niche interest,
// real schools beyond our seeded list, current admissions/news — always scoped by
// the student's hard constraints so results are relevant by distance/budget first.
// The model sometimes leaves an empty slot in its query ("best film schools in )").
// Strip empty parens and dangling prepositions so we never search malformed text.
function cleanWebQuery(query: string): string {
  // Drop unbalanced parens (keeps valid ones like "(CS)") so an empty slot can't
  // leave a stray bracket — left-to-right kills orphan ")", right-to-left orphan "(".
  const balance = (s: string) => {
    let depth = 0, a = "";
    for (const c of s) c === "(" ? (depth++, (a += c)) : c === ")" ? (depth > 0 ? (depth--, (a += c)) : null) : (a += c);
    depth = 0; let b = "";
    for (let i = a.length - 1; i >= 0; i--) { const c = a[i]; c === ")" ? (depth++, (b = c + b)) : c === "(" ? (depth > 0 ? (depth--, (b = c + b)) : null) : (b = c + b); }
    return b;
  };
  return balance(
    query
      .replace(/\(\s*\)/g, "")
      .replace(/\b(in|near|for|around)\s*(?=[).,]|\s*$)/gi, "")
  ).replace(/\s{2,}/g, " ").trim() || "best colleges for this student";
}

async function webLookup(ai: GoogleGenAI, query: string, p: StudentProfile): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `${cleanWebQuery(query)}\n\n${searchConstraints(p)}\nAnswer concisely (2-5 sentences) for a high-school sophomore. Name specific colleges/programs and be concrete; prefer options that fit the student context above.`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: { tools: [{ googleSearch: {} }] as any, temperature: 0.2 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
    .filter((s) => s.url)
    .slice(0, 4);
  return { answer: res.text ?? "", sources };
}

// How well our 17 seeded schools actually cover what this student cares about.
// "thin" = niche interest (e.g. film) we likely lack data for → search-first.
function seededInterestCoverage(p: StudentProfile): "good" | "thin" | "unknown" {
  const hasInterest = (p.interestSignals?.length ?? 0) > 0 || p.intendedMajors.length > 0;
  if (!hasInterest) return "unknown";
  const best = Math.max(0, ...SCHOOLS.map((s) => scoreInterestFit(p, s).interestFit));
  return best >= 45 ? "good" : "thin";
}

// Backstop extractor: the conversational model sometimes replies to a clear fact
// ("I want to study CS") without calling update_profile, silently losing it. This
// forces a temperature-0 extraction of ONLY what's stated, used to fill the gap.
async function backstopExtract(ai: GoogleGenAI, message: string, working: StudentProfile): Promise<Record<string, unknown> | null> {
  try {
    const tool = [{ functionDeclarations: [TOOLS[0].functionDeclarations[0]] }]; // update_profile only
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts: [{ text: `${profileSummary(working)}\n\nFrom the student message below, extract ONLY facts the student explicitly states about themselves — name, grade, city/state/ZIP, budget, first-gen status, transfer status, work schedule, current college, associate degree, transfer-credit concern, country, visa need, international aid need, intended major, chosen/saved/compared target schools, and any genuine interests. Put each in its proper field. Include nothing not present in the message; do not guess or infer.\n\nStudent: ${message}` }] }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { tools: tool as any, toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["update_profile"] } } as any, temperature: 0 },
    });
    const call = (res.functionCalls ?? [])[0];
    return call?.args && typeof call.args === "object" ? (call.args as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Plain-language admissions odds from an acceptance rate.
function admissionsOdds(rate: number): string {
  if (rate >= 0.7) return "very likely to get in";
  if (rate >= 0.5) return "likely — a good target";
  if (rate >= 0.3) return "a realistic target";
  return "a reach";
}

function chosenSchoolIds(p: StudentProfile): string[] {
  return Array.from(new Set([
    ...(p.savedSchoolIds ?? []),
    ...((p.trackedSchools ?? [])
      .filter((s) => ["saved", "draft", "action"].includes(s.status))
      .map((s) => s.id)),
  ])).filter((id) => !!schoolById(id));
}

function chosenSchoolLine(p: StudentProfile): string {
  const names = chosenSchoolIds(p).map((id) => schoolById(id)!.short);
  if (!names.length) return "";
  return `\n\n=== CURRENT MODE ===\nThe student has chosen or saved: ${names.join(", ")}. Switch from broad discovery into application-coach mode: help them meet requirements, improve odds, finish tasks, afford it, and prepare essays/transcripts/recommendations. Do not keep showing broad school-match cards unless they explicitly ask for alternatives or a refreshed list. Prefer school_detail, web_lookup, find_scholarships, and add_task for the chosen school(s).`;
}

function explicitlyRequestsSchoolCards(message: string): boolean {
  return /\b(show|pull up|find|refresh|update|see|give me|compare|list|recommend|recommendations|matches|options|schools|colleges|alternatives)\b/i.test(message);
}

function mediaForSchool(name: string) {
  return {
    imageUrl: `/api/school-media?school=${encodeURIComponent(name)}&kind=campus`,
    logoUrl: `/api/school-media?school=${encodeURIComponent(name)}&kind=logo`,
  };
}

function mergeTargetSchools(p: StudentProfile, names: string[]) {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length) p.targetSchools = Array.from(new Set([...(p.targetSchools ?? []), ...clean]));
}

async function compareSchools(ai: GoogleGenAI, names: string[], focus: string | undefined, p: StudentProfile) {
  const schools = names.map((n) => n.trim()).filter(Boolean).slice(0, 8);
  const rows = [];
  for (const name of schools) {
    const catalog = resolveSchool(name);
    const card = await scorecardLookup(catalog?.name ?? name);
    const label = card?.name ?? catalog?.name ?? name;
    rows.push({
      school: label,
      location: card ? [card.city, card.state].filter(Boolean).join(", ") : catalog ? `${catalog.city}, ${catalog.state}` : undefined,
      acceptanceRatePct: card?.acceptanceRate != null ? Math.round(card.acceptanceRate * 100) : catalog ? Math.round(catalog.acceptanceRate * 100) : undefined,
      netPricePerYearAfterAid: card?.netPrice ?? catalog?.netPrice,
      medianEarnings10yr: card?.medianEarnings,
      gradRatePct: card?.completionRate != null ? Math.round(card.completionRate * 100) : undefined,
      undergradSize: card?.size,
      programContext: catalog
        ? `${catalog.short}: strong in ${catalog.strongMajors.join(", ")}. ${catalog.vibe}`
        : `Scorecard-backed school; use the web context for current ${focus || "program"} details.`,
      source: card ? "College Scorecard" : catalog ? "Halda catalog fallback" : "web context",
    });
  }
  const web = await webLookup(ai, `${schools.join(", ")} ${focus || "computer science"} program context outcomes ROI internships comparison`, p);
  return { schools: rows, webContext: web };
}

// ─────────────────────────────────────────────────────────────────────────────
// Halda as a real tool-using agent. Gemini decides when to:
//   • update_profile     — save facts (incl. AP / dual-enrollment credits)
//   • search_universities— once it knows enough, surface ranked matches
//   • add_task           — put real deadlines (e.g. FAFSA) on the student's list
// We run the tool loop server-side and return the resulting actions.
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";

// Lean tool set. Descriptions are ONE line — when-to-call routing lives in the
// system prompt, not here. update_profile MUST stay first (backstopExtract indexes [0]).
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "update_profile",
        description: "Save facts learned this turn.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            grade: { type: Type.NUMBER, description: "9-12 (sophomore = 10)" },
            highSchool: { type: Type.STRING },
            city: { type: Type.STRING },
            state: { type: Type.STRING, description: "2-letter code, e.g. UT" },
            zip: { type: Type.STRING },
            firstGen: { type: Type.BOOLEAN },
            gpa: { type: Type.STRING },
            testType: { type: Type.STRING, description: "SAT | ACT | PSAT" },
            testScore: { type: Type.STRING },
            intendedMajors: { type: Type.ARRAY, items: { type: Type.STRING } },
            careerGoal: { type: Type.STRING },
            settingPref: { type: Type.STRING, description: "city|suburban|rural|any" },
            sizePref: { type: Type.STRING, description: "small|medium|large|any" },
            maxBudget: { type: Type.NUMBER },
            needsAid: { type: Type.BOOLEAN },
            stayInState: { type: Type.BOOLEAN, description: "wants to stay close to home (also set state)" },
            isTransfer: { type: Type.BOOLEAN },
            worksFullTime: { type: Type.BOOLEAN },
            currentCollege: { type: Type.STRING },
            completedCollegeYears: { type: Type.NUMBER },
            associateDegree: { type: Type.STRING },
            transferCreditsConcern: { type: Type.BOOLEAN },
            country: { type: Type.STRING, description: "home/applicant country if outside the U.S." },
            visaNeed: { type: Type.BOOLEAN },
            internationalAidNeed: { type: Type.BOOLEAN },
            chosenSchools: { type: Type.ARRAY, description: "School names the student explicitly chose, saved, is applying to, or wants to focus on", items: { type: Type.STRING } },
            targetSchools: { type: Type.ARRAY, description: "Free-text school names the student wants to compare or track, including non-catalog schools", items: { type: Type.STRING } },
            interestSignals: {
              type: Type.ARRAY,
              description: "Things the student is genuinely drawn to (a subject, hobby, sport, cause). NOT school names, NOT logistical needs (cost, visa, credit transfer), NOT topics they merely asked about.",
              items: {
                type: Type.OBJECT,
                properties: {
                  interest: { type: Type.STRING, description: "the subject/hobby/cause itself, e.g. 'marine biology', 'soccer'" },
                  intent: { type: Type.STRING, description: "career_path|major|serious_extracurricular|community|fan_culture|personal_hobby" },
                  importance: { type: Type.STRING, description: "low|medium|high|must_have" },
                },
                required: ["interest", "intent", "importance"],
              },
            },
            creditItems: {
              type: Type.ARRAY,
              description: "AP / dual-enrollment / IB credit the student has or plans",
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: 'e.g. "AP Biology"' },
                  type: { type: Type.STRING, description: "ap|dual_enrollment|ib|honors|clep" },
                  status: { type: Type.STRING, description: "completed|taking|planned|considering" },
                  score: { type: Type.STRING },
                  subject: { type: Type.STRING, description: "science|math|writing|…" },
                },
                required: ["source", "type", "status"],
              },
            },
          },
        },
      },
      {
        name: "search_universities",
        description: "Show a ranked school-card deck. Use for first reveal or explicit requests for schools/options/alternatives; do NOT re-run every turn or after they chose a target school unless they ask for alternatives.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            emphasize: { type: Type.STRING, description: "optional weight, e.g. 'affordability', 'film'" },
          },
        },
      },
      {
        name: "school_detail",
        description: "Get fit, odds, and cost for ONE named school.",
        parameters: {
          type: Type.OBJECT,
          properties: { school: { type: Type.STRING } },
          required: ["school"],
        },
      },
      {
        name: "compare_schools",
        description: "Build a data-first comparison table for multiple named schools; use for ROI/outcomes/no-pep-talk comparison requests.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            schools: { type: Type.ARRAY, items: { type: Type.STRING } },
            focus: { type: Type.STRING, description: "program or decision lens, e.g. computer science ROI" },
          },
          required: ["schools"],
        },
      },
      {
        name: "web_lookup",
        description: "Search the live web for an answer or campus color (no cards).",
        parameters: {
          type: Type.OBJECT,
          properties: { query: { type: Type.STRING } },
          required: ["query"],
        },
      },
      {
        name: "virtual_tour",
        description: "Find a YouTube virtual/campus tour video for ONE specific school the student is considering; do not use for broad discovery.",
        parameters: {
          type: Type.OBJECT,
          properties: { school: { type: Type.STRING, description: "The specific school, e.g. BYU or Utah Valley University" } },
          required: ["school"],
        },
      },
      {
        name: "find_scholarships",
        description: "Find scholarships matching this student.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "add_task",
        description: "Put a next step on the student's tracker — a real deadline (use a canonical key so the date fills in) OR a custom 'try this' milestone (shadow a nurse, tour a campus, take a CS elective) that gives them a concrete reason to come back.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING, description: "fafsa | css_profile | psat | common_app | early_action | regular_decision | college_list" },
            title: { type: Type.STRING, description: "for a custom task/milestone (when no key), e.g. 'Shadow a nurse this summer'" },
            detail: { type: Type.STRING },
            due: { type: Type.STRING, description: "ISO date YYYY-MM-DD (custom task)" },
          },
        },
      },
    ],
  },
];

function systemPrompt(): string {
  return `You are Halda, a warm AI college guide for high-school students — mostly sophomores. Text like a sharp, encouraging older sibling: short, plain, a little playful, usually one question at a time.

It is currently 2026; use 2026 whenever you need the current year.

Help each student figure out where they belong. Lead with what they actually came for — a career question, a transfer question, a school comparison — before pivoting to anything else. Learn what they care about and the intent behind it (a passing interest, a possible major, a real career), then connect it to schools, scholarships, and concrete next steps that fit them.

Build their profile as you talk: the moment a student reveals a fact — name, grade, a town or ZIP, budget, first-gen, transfer status, full-time work, current college, associate degree, country, visa need, international aid need, or schools they want to compare — save it that turn; don't wait to be asked. Put each fact in its proper place (a career in careerGoal, money in budget/needsAid, comparison lists in targetSchools), and reserve interest signals for things they're genuinely drawn to — not school names, logistical needs, or topics they merely asked about. Don't assert a fact you haven't confirmed; if age only implies a grade, ask (16 is usually a sophomore or junior).

You have tools to save what you learn, show ranked school matches, compare multiple named schools, look up any single school or the live web, find a YouTube virtual tour for a specific school, find scholarships, and put real next steps on their tracker — reach for them whenever they'd make you more helpful, and if you tell the student you'll pull schools, compare schools, look something up, find a tour, or add a task, do it in the SAME turn. When a student asks for ROI/outcomes/data across multiple schools, switch into comparison mode and use compare_schools instead of normal guidance. When a student chooses/saves/names a school as their target, save it in chosenSchools and shift into helping them get in. Only offer or use virtual_tour when the student is thinking about one particular school; do not offer campus-tour videos during broad discovery or generic matching. When a student hands you the wheel ("lead the way", "just show me") or asks for options, actually show them schools. Their known profile is given every turn: use it, build on it, don't re-ask what's there.

Be specific and honest: name the actual schools, scholarships, and numbers your tools return, and never invent a figure you weren't given. Before you claim a school fits a budget, an aid need, or an eligibility rule (transfer credits, international/visa, in-state cost), confirm it with a tool rather than guessing — and if money is tight, surface real aid and add the FAFSA step.`;
}

export interface AgentResult {
  reply: string;
  updates: ProfileUpdates;
  profile: StudentProfile; // fully merged profile after this turn (for cross-channel state)
  tasks: TaskItem[];
  revealMatches: boolean;
  toolsUsed: string[];
  toolEvents: ToolEvent[]; // visible "agent did X" lines for the chat
}

// Apply update_profile args onto a working copy so later tools see latest data.
function mergeWorking(w: StudentProfile, a: Record<string, unknown>) {
  const scalar = ["name", "email", "phone", "grade", "highSchool", "city", "state", "zip", "firstGen", "isTransfer", "worksFullTime", "currentCollege", "completedCollegeYears", "associateDegree", "transferCreditsConcern", "country", "visaNeed", "internationalAidNeed", "careerGoal", "settingPref", "sizePref", "maxBudget", "needsAid", "stayInState", "gpa", "testType", "testScore"] as const;
  const wr = w as unknown as Record<string, unknown>;
  for (const k of scalar) if (a[k] !== undefined) wr[k] = a[k];
  if (Array.isArray(a.targetSchools)) mergeTargetSchools(w, a.targetSchools as string[]);
  if (Array.isArray(a.intendedMajors)) w.intendedMajors = Array.from(new Set([...w.intendedMajors, ...(a.intendedMajors as string[])]));
  if (Array.isArray(a.interestSignals)) {
    for (const s of a.interestSignals as StudentProfile["interestSignals"]) {
      const i = w.interestSignals.findIndex((x) => x.interest.toLowerCase() === s.interest.toLowerCase());
      if (i >= 0) w.interestSignals[i] = { ...w.interestSignals[i], ...s };
      else w.interestSignals.push(s);
    }
  }
  if (Array.isArray(a.creditItems)) {
    for (const c of a.creditItems as StudentProfile["creditWallet"]) {
      const i = w.creditWallet.findIndex((x) => x.source.toLowerCase() === c.source.toLowerCase());
      if (i >= 0) w.creditWallet[i] = { ...w.creditWallet[i], ...c };
      else w.creditWallet.push({ ...c, id: c.id || `cr_${w.creditWallet.length}_${Date.now()}` });
    }
  }
  if (Array.isArray(a.chosenSchools)) {
    const names = a.chosenSchools as string[];
    mergeTargetSchools(w, names);
    const ids = names.map((name) => resolveSchool(name)?.id)
      .filter(Boolean) as string[];
    if (ids.length) w.savedSchoolIds = Array.from(new Set([...(w.savedSchoolIds ?? []), ...ids]));
  }
}

export async function runAgent(opts: {
  apiKey: string;
  profile: StudentProfile;
  message: string;
  history?: { role: "user" | "model"; text: string }[];
  speak?: boolean;
  matchesRevealed?: boolean;
}): Promise<AgentResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const working: StudentProfile = JSON.parse(JSON.stringify(opts.profile));
  const updates: ProfileUpdates = {};
  const tasks: TaskItem[] = [];
  const toolsUsed: string[] = [];
  const toolEvents: ToolEvent[] = [];
  let revealMatches = false;

  deriveLocation(working, updates, opts.message, opts.history);

  // The student's known profile rides in the SYSTEM prompt every turn so the
  // model treats it as authoritative and never re-asks what's already there.
  const perTurn = `=== THIS STUDENT (use it; don't re-ask what's already here) ===\n${profileSummary(working)}${chosenSchoolLine(working)}`;
  const sysInstruction = `${systemPrompt()}\n\n${perTurn}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: `${opts.speak === false ? "(Reading a spoken transcript — call tools but keep reply empty.) " : ""}Student: ${opts.message}` }] },
  ];

  let reply = "";
  // Dedupe identical read-only tool calls within a turn — the model sometimes
  // fires school_detail on the same school 2-3× in one hop. Reuse the result and
  // suppress the duplicate chip instead of repeating the work.
  const callCache = new Map<string, unknown>();
  const mayShowSchoolCards = !opts.matchesRevealed || explicitlyRequestsSchoolCards(opts.message);
  for (let hop = 0; hop < 5; hop++) {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { systemInstruction: sysInstruction, tools: TOOLS as any, temperature: 0.6 },
    });
    const calls = res.functionCalls ?? [];
    if (!calls.length) { reply = res.text ?? reply; break; }

    // Push the model's ACTUAL content so functionCall thought-signatures (required
    // by Gemini 3) are preserved when we send the tool results back.
    const modelContent = res.candidates?.[0]?.content;
    contents.push(modelContent ?? { role: "model", parts: calls.map((c) => ({ functionCall: c })) });
    const responseParts: { functionResponse: unknown }[] = [];
    for (const call of calls) {
      const raw = call.args;
      const args = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      let result: unknown = { ok: true };
      try {
      // The model occasionally hallucinates a tool name like "default_profile";
      // if it's clearly a profile save, honor it so the facts aren't lost.
      const name = call.name === "update_profile" || (call.name !== "search_universities" && /profile/i.test(call.name ?? "")) ? "update_profile" : call.name;
      // Identical read-only call already run this turn → reuse, skip the dup chip.
      const sig = `${name}:${JSON.stringify(args)}`;
      const cached = name !== "update_profile" ? callCache.get(sig) : undefined;
      if (cached !== undefined) {
        result = cached;
      } else if (name === "update_profile") {
        Object.assign(updates, args);
        mergeWorking(working, args);
        deriveLocation(working, updates, opts.message, opts.history);
      } else if (name === "search_universities") {
        revealMatches = true;
        const ranked = rankInterestMatches(working, 5);
        const top = ranked.map((m) => {
          const s = schoolById(m.schoolId)!;
          return {
            school: s.short, matchPct: m.overallFit, admissions: admissionsOdds(s.acceptanceRate),
            netPricePerYearAfterAid: s.netPrice,
            studentRating: m.rating ? `${m.rating.overall}/5 from ${m.rating.reviewCount} students` : undefined,
            whyItFits: m.reasons.slice(0, 3),
            evidence: m.evidenceBadges.slice(0, 3).map((b) => b.title),
            watchOut: m.concerns.slice(0, 1),
            creditFit: m.creditFit.level,
          };
        });
        // Cards are a visual payoff, not a every-turn ticker. After the first
        // reveal, only show them again when the student explicitly asks.
        if (mayShowSchoolCards)
          toolEvents.push({ kind: "search", label: "Right-fit schools", detail: `${ranked.length} found`, schools: ranked.map((m) => ({ schoolId: m.schoolId, matchPct: m.overallFit })) });
        // When our seeded list is thin for this interest, the SAME step also pulls
        // real specialized programs from the web so cards never stand alone.
        let webExtras;
        if (seededInterestCoverage(working) === "thin") {
          const focus = String(args.emphasize || working.intendedMajors[0] || working.interestSignals[0]?.interest || "their interests");
          const wl = await webLookup(ai, `best colleges and programs for ${focus}`, working);
          webExtras = { note: `Our card list is the closest local fit; these web-found programs are stronger for ${focus}.`, answer: wl.answer, sources: wl.sources };
          toolEvents.push({ kind: "web", label: "Also searched the web", detail: focus.slice(0, 40), items: wl.sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
        }
        result = { matches: top, ...(webExtras ? { webExtras } : {}) };
      } else if (name === "school_detail") {
        const sc = resolveSchool(String(args.school ?? ""));
        if (sc) {
          const m = scoreInterestFit(working, sc);
          // Pull official outcome figures (grad rate, 10-yr earnings) so a seeded
          // school shows the SAME real numbers as a Scorecard one — no "N/A"
          // sitting next to live data. Undefined keys drop out on serialization.
          const official = await scorecardLookup(sc.name);
          const wl = await webLookup(ai, `${sc.name} ${opts.message}: program quality, admissions requirements, student life`, working);
          result = {
            school: sc.name,
            // What a student actually cares about, in order:
            fitForYourInterests: { matchPct: m.overallFit, why: m.reasons.slice(0, 3), evidence: m.evidenceBadges.slice(0, 3).map((b) => b.title), strongPrograms: sc.strongMajors },
            wouldYouBelong: m.rating ? { studentsLoveItFor: belongingSignals(m.rating), studentRating: `${m.rating.overall}/5 from ${m.rating.reviewCount} students`, tip: "For real culture/vibe & whether they'd fit in, call web_lookup." } : { tip: "Call web_lookup for student-life/culture color." },
            yourChances: { odds: admissionsOdds(official?.acceptanceRate ?? sc.acceptanceRate), acceptanceRatePct: Math.round((official?.acceptanceRate ?? sc.acceptanceRate) * 100), source: official ? "College Scorecard" : "Halda catalog fallback" },
            cost: { netPricePerYearAfterAid: official?.netPrice ?? sc.netPrice, creditFit: m.creditFit.level, source: official?.netPrice != null ? "College Scorecard" : "Halda catalog fallback" },
            outcomes: official && (official.medianEarnings != null || official.completionRate != null)
              ? { gradRatePct: official.completionRate != null ? Math.round(official.completionRate * 100) : undefined, medianEarnings10yr: official.medianEarnings ?? undefined, note: "official U.S. Dept of Education figures" }
              : undefined,
            webContext: { answer: wl.answer, sources: wl.sources },
            cautions: m.concerns.slice(0, 1),
          };
          toolEvents.push({ kind: "school", label: `Pulling up ${sc.short}`, detail: `${m.overallFit}% match`, schools: [{ schoolId: sc.id, matchPct: m.overallFit }] });
          toolEvents.push({ kind: "web", label: `Searched ${sc.short}`, detail: "program context", items: wl.sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
        } else {
          // Not in our catalog (e.g. MIT, Stanford) — never fake a card. Pull REAL
          // figures from College Scorecard first; fall back to the live web.
          const school = String(args.school ?? "").trim();
          const card = await scorecardLookup(school);
          if (card) {
            result = {
              school: card.name, source: "scorecard",
              location: [card.city, card.state].filter(Boolean).join(", ") || undefined,
              yourChances: card.acceptanceRate != null ? { acceptanceRatePct: Math.round(card.acceptanceRate * 100), odds: admissionsOdds(card.acceptanceRate) } : undefined,
              cost: card.netPrice != null ? { netPricePerYearAfterAid: card.netPrice } : undefined,
              undergradSize: card.size,
              gradRatePct: card.completionRate != null ? Math.round(card.completionRate * 100) : undefined,
              medianEarnings10yr: card.medianEarnings,
              note: "Official U.S. Dept of Education figures (College Scorecard). Not in our match catalog, so no personalized fit % — but these numbers are real.",
            };
            toolEvents.push({
              kind: "school",
              label: `Looked up ${card.name}`.slice(0, 42),
              detail: "official data",
              media: [{ title: card.name, sub: "Live campus image", ...mediaForSchool(card.name) }],
            });
          } else {
            const wl = await webLookup(ai, `${school}: acceptance rate, net price after aid, and what it's known for`, working);
            result = { school, source: "web", info: wl.answer, sources: wl.sources, note: "From the live web — confirm on the school's site." };
            toolEvents.push({
              kind: "web",
              label: `Looked up ${school}`.slice(0, 42),
              detail: "from the web",
              items: wl.sources.map((s) => ({ title: s.title || s.url, sub: s.url })),
              media: [{ title: school, sub: "Live campus image", ...mediaForSchool(school) }],
            });
          }
        }
      } else if (name === "compare_schools") {
        const names = (Array.isArray(args.schools) ? args.schools : [])
          .map(String)
          .filter(Boolean);
        mergeTargetSchools(working, names);
        Object.assign(updates, { targetSchools: working.targetSchools });
        const comparison = await compareSchools(ai, names, String(args.focus || working.intendedMajors[0] || "computer science"), working);
        result = comparison;
        toolEvents.push({
          kind: "compare",
          label: "Comparison table",
          detail: `${comparison.schools.length} schools`,
          items: comparison.schools.map((s) => ({
            title: s.school,
            sub: [
              s.acceptanceRatePct != null ? `${s.acceptanceRatePct}% admit` : null,
              s.netPricePerYearAfterAid != null ? `$${s.netPricePerYearAfterAid.toLocaleString()}/yr net` : null,
              s.medianEarnings10yr != null ? `$${s.medianEarnings10yr.toLocaleString()} earnings` : null,
              s.gradRatePct != null ? `${s.gradRatePct}% grad` : null,
            ].filter(Boolean).join(" · "),
          })),
        });
        if (comparison.webContext.sources.length)
          toolEvents.push({ kind: "web", label: "Program context", detail: String(args.focus || "outcomes").slice(0, 40), items: comparison.webContext.sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
      } else if (name === "web_lookup") {
        const q = cleanWebQuery(String(args.query ?? ""));
        const { answer, sources } = await webLookup(ai, q, working);
        result = { answer, sources };
        toolEvents.push({ kind: "web", label: "Searching the web", detail: String(args.school || q).slice(0, 48), items: sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
      } else if (name === "virtual_tour") {
        const requested = String(args.school ?? "").trim();
        const sc = resolveSchool(requested);
        const school = sc?.name ?? requested;
        const video = await findVirtualTourVideo(school);
        result = video;
        toolEvents.push({
          kind: "video",
          label: `YouTube virtual tour`,
          detail: sc?.short ?? school.slice(0, 24),
          videos: [{
            title: video.title,
            sub: video.isSearchFallback ? "Open YouTube search results" : [video.channel, "Campus tour"].filter(Boolean).join(" · "),
            url: video.url,
            thumbnailUrl: video.thumbnailUrl,
          }],
        });
      } else if (name === "find_scholarships") {
        const found = findScholarships(working);
        result = { scholarships: found };
        toolEvents.push({ kind: "scholarship", label: "Scholarships for you", detail: `${found.length} found`, items: found.map((f) => ({ title: f.name, sub: f.why })) });
      } else if (name === "add_task") {
        const t = makeTask(args as { key?: string; title?: string; detail?: string; due?: string }, working.grade);
        tasks.push(t);
        working.tasks.push(t);
        result = { added: { title: t.title, due: t.due } };
        toolEvents.push({ kind: "task", label: "Added to your tasks", detail: t.title });
      } else {
        result = { error: `Unknown tool "${call.name}". Use one of: update_profile, search_universities, school_detail, compare_schools, web_lookup, virtual_tour, find_scholarships, add_task.` };
      }
      if (name !== "update_profile" && cached === undefined) callCache.set(sig, result);
      } catch (err) {
        // A malformed tool call shouldn't crash the turn — tell the model and move on.
        result = { error: `Could not run ${call.name}: ${(err as Error).message}` };
      }
      toolsUsed.push(call.name ?? "?");
      responseParts.push({ functionResponse: { name: call.name, response: result as object } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  // Data-loss backstop: the conversational model often answers a fact-laden
  // message without saving — or saves only the major and silently drops the
  // name, grade, first-gen, or budget. Force a temp-0 extraction and merge every
  // field the model DIDN'T already save this turn, so no stated fact is lost.
  if (opts.message.trim().length >= 8) {
    const extra = await backstopExtract(ai, opts.message, working);
    if (extra) {
      const saved = updates as Record<string, unknown>;
      const rescued: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(extra)) {
        if (v != null && saved[k] === undefined) rescued[k] = v;
      }
      if (Object.keys(rescued).length) {
        Object.assign(updates, rescued);
        mergeWorking(working, rescued);
        deriveLocation(working, updates, opts.message, opts.history);
      }
    }
  }

  // Never leave the student with silence: if the model only called tools and never
  // spoke, do one final text-only pass (skipped for voice extraction, which wants no reply).
  if (!reply.trim() && opts.speak !== false) {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents,
      config: { systemInstruction: sysInstruction, temperature: 0.6 },
    });
    reply = (res.text ?? "").trim() || "Got it! Tell me a little more and I'll help you find schools that fit.";
  }

  return { reply, updates, profile: working, tasks, revealMatches, toolsUsed, toolEvents };
}
