import { GoogleGenAI, Type } from "@google/genai";
import type { StudentProfile, TaskItem, ToolEvent, School } from "./types";
import { profileCompleteness } from "./match";
import { rankInterestMatches, scoreInterestFit } from "./interest-match";
import { schoolById, SCHOOLS } from "./schools";
import { RATING_CATEGORIES, type RmpRating } from "./ratings";
import { makeTask } from "./deadlines";
import { findScholarships } from "./scholarships";
import { resolveZip, stateFromText } from "./geo";
import { scorecardLookup } from "./scorecard";
import { profileSummary, type ProfileUpdates } from "./halda-prompt";

// "Stay in-state" only ranks correctly if we know WHICH state. The model often
// sets stayInState=true but forgets state, so derive it from the conversation
// (the "stay in Utah" message, their ZIP) and persist it.
function normalizeState(working: StudentProfile, updates: ProfileUpdates, message: string, history?: { role: string; text: string }[]) {
  if (!working.stayInState || working.state) return;
  const texts = [message, ...((history ?? []).map((h) => h.text))];
  const found = texts.map(stateFromText).find(Boolean) || (working.zip ? resolveZip(working.zip)?.state : undefined);
  if (found) { working.state = found; updates.state = found; }
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
      contents: [{ role: "user", parts: [{ text: `${profileSummary(working)}\n\nFrom the student message below, extract ONLY facts explicitly stated in it (a stated major or interest MUST be included). Include nothing that isn't in the message.\n\nStudent: ${message}` }] }],
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

// ─────────────────────────────────────────────────────────────────────────────
// Halda as a real tool-using agent. Gemini decides when to:
//   • update_profile     — save facts (incl. AP / dual-enrollment credits)
//   • search_universities— once it knows enough, surface ranked matches
//   • add_task           — put real deadlines (e.g. FAFSA) on the student's list
// We run the tool loop server-side and return the resulting actions.
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "update_profile",
        description:
          "Save new facts learned this turn (only what you actually learned). Includes AP / dual-enrollment / IB college credit the student has or plans.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "full name incl. last name if given" },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            grade: { type: Type.NUMBER, description: "9-12; sophomore = 10" },
            highSchool: { type: Type.STRING },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            zip: { type: Type.STRING },
            firstGen: { type: Type.BOOLEAN, description: "true if first in family to attend college" },
            gpa: { type: Type.STRING, description: 'cumulative GPA if they share it, e.g. "3.8"' },
            testType: { type: Type.STRING, description: "SAT | ACT | PSAT" },
            testScore: { type: Type.STRING, description: 'their score, e.g. "1340" (SAT) or "29" (ACT)' },
            intendedMajors: { type: Type.ARRAY, items: { type: Type.STRING } },
            careerGoal: { type: Type.STRING },
            settingPref: { type: Type.STRING, description: "city|suburban|rural|any" },
            sizePref: { type: Type.STRING, description: "small|medium|large|any" },
            maxBudget: { type: Type.NUMBER },
            needsAid: { type: Type.BOOLEAN },
            stayInState: { type: Type.BOOLEAN, description: "true if the student wants to stay in-state / close to home (also set state)" },
            interestSignals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  interest: { type: Type.STRING },
                  intent: { type: Type.STRING, description: "career_path|major|serious_extracurricular|community|fan_culture|personal_hobby" },
                  importance: { type: Type.STRING, description: "low|medium|high|must_have" },
                  evidenceQuote: { type: Type.STRING },
                },
                required: ["interest", "intent", "importance"],
              },
            },
            creditItems: {
              type: Type.ARRAY,
              description: "AP exams, dual/concurrent enrollment, IB, etc.",
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: 'e.g. "AP Biology", "Concurrent Enrollment Math 1050"' },
                  type: { type: Type.STRING, description: "ap|dual_enrollment|ib|honors|clep" },
                  subject: { type: Type.STRING, description: "science|math|writing|social science|…" },
                  status: { type: Type.STRING, description: "completed|taking|planned|considering" },
                  score: { type: Type.STRING, description: 'grade or AP score, or "unknown"' },
                  note: { type: Type.STRING },
                },
                required: ["source", "type", "subject", "status"],
              },
            },
          },
        },
      },
      {
        name: "search_universities",
        description:
          "THE way to SHOW the student schools — they appear as interactive cards. Use it for ANY interest: it ranks our right-fit schools and, when our data is thin for that interest, automatically pulls real specialized programs from the web too. It's a BIG reveal, so only call it once the student has agreed to see schools (they asked 'show me some schools', or you offered and they said yes). Don't call it proactively or re-run it every turn.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            emphasize: { type: Type.STRING, description: "optional weight, e.g. 'affordability', 'film', 'graduate early'" },
          },
        },
      },
      {
        name: "school_detail",
        description:
          "Get the full picture on ONE specific school the student named — works for ANY school. If it's in our core catalog you get fit %, belonging signals, admission odds, net price + rating; if it's NOT (e.g. MIT, Stanford, an out-of-state school), it automatically returns real figures from the live web instead. Use this (NOT search_universities) whenever they ask about a single named school, e.g. 'why BYU?', 'my chances at MIT?', 'tell me about UVU'.",
        parameters: {
          type: Type.OBJECT,
          properties: { school: { type: Type.STRING, description: "the school name the student mentioned" } },
          required: ["school"],
        },
      },
      {
        name: "web_lookup",
        description:
          "Search the live web to ANSWER a question or add color — campus culture / whether they'd FIT IN, a specific school's vibe, current facts (rankings, tuition, deadlines, news), or naming programs beyond our list — WITHOUT showing the card list. (To actually SHOW schools as cards, use search_universities, which already web-enriches itself.) Pass a focused query; the student's location/budget filters apply automatically. Don't use it for numbers search_universities/school_detail already give.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "focused search, e.g. 'best film schools', 'BYU student life for a shy first-gen biology major'" },
            school: { type: Type.STRING, description: "the school it's about, if any" },
          },
          required: ["query"],
        },
      },
      {
        name: "find_scholarships",
        description:
          "Find scholarships and aid that fit this student. Call this when they ask about scholarships, paying for college, or money. The student will SEE the results appear.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "add_task",
        description:
          "Add a task or deadline to the student's list. Prefer a canonical key so the real date is filled in. If the student needs financial aid, add_task with key 'fafsa'.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING, description: "fafsa | css_profile | psat | common_app | early_action | regular_decision | college_list" },
            title: { type: Type.STRING, description: "for a custom task (when no key)" },
            detail: { type: Type.STRING },
            due: { type: Type.STRING, description: "ISO date YYYY-MM-DD (custom task)" },
            kind: { type: Type.STRING, description: "deadline|todo|milestone" },
          },
        },
      },
    ],
  },
];

function systemPrompt(): string {
  return `You are Halda, a warm AI college guide for high-school students (mostly SOPHOMORES). Text like a sharp, encouraging older sibling: short messages, ONE question at a time, plain language, a little playful.

YOUR JOB: learn what the student actually cares about — and the INTENT behind it (career? major? serious? community? fan? just fun?) — then connect it to schools where it becomes a path. "I like soccer" can mean 5 things; if it's ambiguous, ask which.

COLD START: if KNOWN SO FAR is empty or nearly empty (you don't know their name + an interest/major yet), do NOT answer a generic question cold. Warmly open with ONE engaging question first — their name and what they're into / what matters most to them in college — so you have something to work with.

Naturally pick up everything that helps: high school, whether they'd be first-gen, campus setting/size, and money reality (budget / needs aid). Save it with update_profile as you go. If a student names their high school but not their city, infer the likely city + state from the school name (e.g. "Austin High School" -> Austin, TX) and save those too as a best estimate.

LOCATION MATTERS: if the student says they want to stay in-state or close to home (e.g. "stay in Utah"), set stayInState=true AND save state (e.g. "UT"). A single named major (e.g. "biology") is enough to base matches on — you don't need a separate interest.

DON'T BE GREEDY WITH OUR CARD LIST: the offer-first rule is ONLY about search_universities (our ranked interactive CARDS). Don't dump those unprompted — once you have enough (name, grade, location, an interest/major), OFFER first ("I think I've got enough to pull up a few schools that fit — want to see them?") and call search_universities only after they say yes or directly ask. This gate does NOT apply to web_lookup or school_detail — gathering and sharing info is always fine, so if they ask "where should I look?" for a niche interest, just web_lookup and answer (no need to offer first). Once you've shown the card list, don't re-run the search every turn; only refresh if they ask or you offer again.

SHOWING SCHOOLS = search_universities, ALWAYS: when the student wants to see schools — for ANY interest, niche or not — call search_universities. It shows our closest matches as cards AND, when our data is thin (seededCoverage=thin, e.g. film/fashion/marine biology), automatically adds real specialized programs from the web in the same step. So you never have to choose between cards and the web — one call does both. Use web_lookup only to answer a question or add color without the card list. Always narrow with the hard facts first (location, stay-in-state, budget) — those shape the ranking and the web search automatically.

SAVE FACTS AS YOU GO: the moment the student states a fact — name, grade, high school, city/ZIP, a major or interest, budget, first-gen, AP credit, GPA, email, phone — call update_profile to save it, EVEN IF you also search or web_lookup that same turn. Never let a stated fact go unsaved.

GET CONTACT BASICS (don't skip — this is how schools reach them with aid): early on, make sure you capture their LOCATION (city + ZIP — ask "what city or ZIP are you in?" if unknown, it's needed to find nearby schools) and HIGH SCHOOL. Naturally — never as a form. Then once you've been helpful and built some trust, offer to keep them posted: "Want me to text you reminders before deadlines? What's a good cell + email?" and save phone + email. Frame it as value to them; one ask, no pressure, and respect a no.

KNOW WHO YOU'RE TALKING TO — adapt, don't run the same script:
- TRANSFER student (mentions "transfer", "community college", "already in college", "credits to move"): focus on transfer pathways, articulation agreements, and which credits carry — not freshman admissions or PSAT.
- CAREER-FIRST (leads with a job/career, unsure about college): honor non-degree routes too — certificates, bootcamps, apprenticeships, 2-year-then-transfer — alongside degrees. Don't assume a 4-year is the goal.
- INTERNATIONAL (location/school outside the US, or says "international"): no FAFSA (it's US-only); point to international admissions, English-proficiency tests, and need-aware schools.
- OVERWHELMED / "what do I even do now": don't interrogate. Validate, then give ONE concrete next step they can do this week, and stop.

SOPHOMORES — they have TIME, so coach milestones, not panic: for grade 10, the move is explore + build, not apply. Suggest a grade-right next step (try classes in an interest, keep GPA up, plan to take the PSAT next fall, bank AP/dual-enrollment) and — since the visit may be short — leave a come-back hook: "We've made real progress. Want me to text you in a few weeks to pick the next step?" (offer to save phone for that).

GPA & TEST SCORES — ask only when they MATTER: most sophomores don't have test scores yet, so don't interrogate. But the moment the student aims at selective/competitive schools, asks "what are my chances / will I get in", or names a reach school, ask for their GPA and any SAT/ACT/PSAT score (whatever they have) and save it — those drive admissions. Save with update_profile (gpa, testType, testScore). Never re-ask what's in KNOWN SO FAR.

COLLEGE CREDIT: AP / dual-enrollment / IB can save money and time — capture each as a credit item. But ONLY ask about credits if you don't already know them (check KNOWN SO FAR first).

TOOLS — use the RIGHT one, and don't over-call:
- update_profile: whenever you learn ANY new fact.
- search_universities: the ONE way to SHOW schools as cards (works for any interest; auto-adds web programs when our data is thin) — only after the student asked or said yes to your offer. Not for a single-school question, and not every turn.
- school_detail: when they ask about ONE named school ("why BYU?", "tell me about UVU", "would I fit in at Utah?", "my odds at Utah?"). This is how you answer with real numbers.
- web_lookup: to answer a question or add color WITHOUT the card list — culture/fitting-in, a school's vibe, current facts, or naming programs beyond our list. Cite naturally ("students online say…", "according to…"). Don't use it for numbers school_detail already has.
- find_scholarships: when they ask about scholarships, aid, or paying for college.
- add_task: real deadlines. If they need aid → key:"fafsa". Don't re-add a task that's already on their list.

USE TOOL RESULTS — being specific is the difference between helpful and useless:
- After search_universities: name your top 1-2 cards and say WHY using their match %, net price (in dollars/yr after aid), and one concrete reason. e.g. "BYU's your top match at 96% — about $13k/yr after aid, and students rate it 4.4/5 for its nursing pipeline." If the result includes webExtras, ALSO mention those real programs by name ("for dedicated film, USC and Chapman are the standouts"). Surface a real "watch out" if one came back.
- After school_detail: lead with how it fits THEIR interests (the match % + a concrete why tied to what they care about) and whether they'd BELONG (student-life signals / what students love it for), then their CHANCES of getting in — frame the number as the school's overall acceptance RATE ("they admit about 2 of every 3 applicants"), NOT a personal guarantee of this student's odds. Bring up net price + rating as support, not the headline — a sophomore cares about fitting in and getting in at least as much as cost. If there's a caution, say it honestly. If they're asking about culture/vibe/fitting in and you want real color, call web_lookup.
- After school_detail with source:"scorecard" (a school beyond our catalog, e.g. MIT): lead with the real numbers — acceptance rate, net price/yr, grad rate, median earnings — and attribute to official data ("per the U.S. Dept of Education, ~4% admit rate, ~$20k/yr net"). Be honest it's not in our personalized-match set, so no fit %. If they have stats, weigh their chances realistically.
- After school_detail with source:"web": give the real figures it found and attribute them; never claim a match % or rating we don't have.
- After web_lookup: NAME the specific schools/programs it returned (don't say "some great options" — say which ones and one concrete reason each), or weave in the culture/belonging detail you asked for. Attribute lightly ("students say…", "according to…") and never invent details it didn't return.
- After find_scholarships: NAME the actual scholarships you got back (don't just say "some options") with a one-line why for each.

NEVER INVENT NUMBERS. Only state stats a tool actually gave you (match %, net price, acceptance odds, RateMyProfessor rating). Do NOT make up admit rates, board-pass rates, salaries, or aid amounts — if you don't have the number, speak qualitatively. Banned filler with no specifics: "super respected", "fantastic choice", "great program", "world-class".

DON'T REPEAT YOURSELF: never re-ask something already in KNOWN SO FAR or the history. If you know their AP score, use it. Ask about AP/dual-enrollment at most once, ever. Mention the pre-med "don't skip core science with AP" caution at MOST once, and only when actually discussing pre-med / that credit decision — never in scholarship, sport, or general chat. If profile completeness is ≥ 75%, stop interrogating and guide with data.

Keep replies to 2-4 sentences, plain and warm. Answer the actual question FIRST, then at most ONE fresh follow-up (only if it helps) — don't default to FAFSA/AP every turn.`;
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
  const scalar = ["name", "email", "phone", "grade", "highSchool", "city", "state", "zip", "firstGen", "careerGoal", "settingPref", "sizePref", "maxBudget", "needsAid", "stayInState", "gpa", "testType", "testScore"] as const;
  const wr = w as unknown as Record<string, unknown>;
  for (const k of scalar) if (a[k] !== undefined) wr[k] = a[k];
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
}

export async function runAgent(opts: {
  apiKey: string;
  profile: StudentProfile;
  message: string;
  history?: { role: "user" | "model"; text: string }[];
  speak?: boolean;
}): Promise<AgentResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const working: StudentProfile = JSON.parse(JSON.stringify(opts.profile));
  const updates: ProfileUpdates = {};
  const tasks: TaskItem[] = [];
  const toolsUsed: string[] = [];
  const toolEvents: ToolEvent[] = [];
  let revealMatches = false;

  normalizeState(working, updates, opts.message, opts.history);
  const completeness = profileCompleteness(working);
  const enoughToSearch =
    !!working.name && !!working.grade && !!(working.city || working.state || working.zip) &&
    (working.interestSignals.length >= 1 || working.intendedMajors.length >= 1);
  const coverage = seededInterestCoverage(working);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    {
      role: "user",
      parts: [{
        text: `${profileSummary(working)}\nProfile completeness: ${completeness}%. readyToOfferSchools=${enoughToSearch} (if true and they haven't asked to see schools, OFFER — don't auto-present). seededCoverage=${coverage} (thin = our seeded data is light here; search_universities will automatically add real web programs alongside the cards — still show the cards).${opts.speak === false ? " (Reading a spoken transcript — call tools but keep reply empty.)" : ""}\n\nStudent: ${opts.message}`,
      }],
    },
  ];

  let reply = "";
  for (let hop = 0; hop < 5; hop++) {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { systemInstruction: systemPrompt(), tools: TOOLS as any, temperature: 0.6 },
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
      if (name === "update_profile") {
        Object.assign(updates, args);
        mergeWorking(working, args);
        normalizeState(working, updates, opts.message, opts.history);
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
        // Cards the chat renders inline — ALWAYS shown (the visual payoff).
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
          result = {
            school: sc.name,
            // What a student actually cares about, in order:
            fitForYourInterests: { matchPct: m.overallFit, why: m.reasons.slice(0, 3), evidence: m.evidenceBadges.slice(0, 3).map((b) => b.title), strongPrograms: sc.strongMajors },
            wouldYouBelong: m.rating ? { studentsLoveItFor: belongingSignals(m.rating), studentRating: `${m.rating.overall}/5 from ${m.rating.reviewCount} students`, tip: "For real culture/vibe & whether they'd fit in, call web_lookup." } : { tip: "Call web_lookup for student-life/culture color." },
            yourChances: { odds: admissionsOdds(sc.acceptanceRate), acceptanceRatePct: Math.round(sc.acceptanceRate * 100) },
            cost: { netPricePerYearAfterAid: sc.netPrice, creditFit: m.creditFit.level },
            cautions: m.concerns.slice(0, 1),
          };
          toolEvents.push({ kind: "school", label: `Pulling up ${sc.short}`, detail: `${m.overallFit}% match` });
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
            toolEvents.push({ kind: "school", label: `Looked up ${card.name}`.slice(0, 42), detail: "official data" });
          } else {
            const wl = await webLookup(ai, `${school}: acceptance rate, net price after aid, and what it's known for`, working);
            result = { school, source: "web", info: wl.answer, sources: wl.sources, note: "From the live web — confirm on the school's site." };
            toolEvents.push({ kind: "web", label: `Looked up ${school}`.slice(0, 42), detail: "from the web", items: wl.sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
          }
        }
      } else if (name === "web_lookup") {
        const q = cleanWebQuery(String(args.query ?? ""));
        const { answer, sources } = await webLookup(ai, q, working);
        result = { answer, sources };
        toolEvents.push({ kind: "web", label: "Searching the web", detail: String(args.school || q).slice(0, 48), items: sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
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
        result = { error: `Unknown tool "${call.name}". Use one of: update_profile, search_universities, school_detail, web_lookup, find_scholarships, add_task.` };
      }
      } catch (err) {
        // A malformed tool call shouldn't crash the turn — tell the model and move on.
        result = { error: `Could not run ${call.name}: ${(err as Error).message}` };
      }
      toolsUsed.push(call.name ?? "?");
      responseParts.push({ functionResponse: { name: call.name, response: result as object } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  // Data-loss backstop: if this turn captured no major/interest but the student
  // said something substantive, force an extraction and apply it ONLY if it found
  // a major/interest (so we never lose a stated fact, and never add noise).
  if (!updates.intendedMajors && !updates.interestSignals && opts.message.trim().length >= 12) {
    const extra = await backstopExtract(ai, opts.message, working);
    if (extra && (extra.intendedMajors || extra.interestSignals)) {
      Object.assign(updates, extra);
      mergeWorking(working, extra);
    }
  }

  // Never leave the student with silence: if the model only called tools and never
  // spoke, do one final text-only pass (skipped for voice extraction, which wants no reply).
  if (!reply.trim() && opts.speak !== false) {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents,
      config: { systemInstruction: systemPrompt(), temperature: 0.6 },
    });
    reply = (res.text ?? "").trim() || "Got it! Tell me a little more and I'll help you find schools that fit.";
  }

  return { reply, updates, profile: working, tasks, revealMatches, toolsUsed, toolEvents };
}
