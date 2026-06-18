import { GoogleGenAI, Type } from "@google/genai";
import type { StudentProfile, TaskItem, ToolEvent, School } from "./types";
import { profileCompleteness } from "./match";
import { rankInterestMatches, scoreInterestFit } from "./interest-match";
import { schoolById, SCHOOLS } from "./schools";
import { RATING_CATEGORIES, type RmpRating } from "./ratings";
import { makeTask } from "./deadlines";
import { findScholarships } from "./scholarships";
import { profileSummary, type ProfileUpdates } from "./halda-prompt";

// Resolve a student-typed school name to a seeded school (fuzzy: short, name, tokens).
function resolveSchool(q: string): School | undefined {
  const n = q.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (!n) return undefined;
  return (
    SCHOOLS.find((s) => s.short.toLowerCase() === n || s.name.toLowerCase() === n) ||
    SCHOOLS.find((s) => n.includes(s.short.toLowerCase()) || s.name.toLowerCase().includes(n)) ||
    SCHOOLS.find((s) => n.split(" ").some((w) => w.length > 3 && s.name.toLowerCase().includes(w)))
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

// Run a focused, Google-grounded web lookup and return a concise answer + sources.
// Lets the agent pull live culture/belonging color our seeded data can't cover.
async function webLookup(ai: GoogleGenAI, query: string): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Answer concisely for a high-school sophomore (2-4 sentences), focusing on student life, culture, and whether they'd fit in: ${query}`,
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
            name: { type: Type.STRING },
            grade: { type: Type.NUMBER, description: "9-12; sophomore = 10" },
            highSchool: { type: Type.STRING },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            zip: { type: Type.STRING },
            firstGen: { type: Type.BOOLEAN, description: "true if first in family to attend college" },
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
          "Present the ranked list of right-fit schools — the student SEES them as interactive cards. This is a BIG reveal, so only call it once the student has agreed to see schools: either they explicitly asked ('what schools should I look at?', 'show me some schools'), or you offered and they said yes. Do NOT call it proactively, and do NOT re-run it every turn.",
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
          "Get the full picture on ONE specific school the student named — how it fits THEIR interests, whether they'd belong / find their people (student-life signals), their real chances of getting in, plus net price and student rating. Use this (NOT search_universities) when they ask about a single school, e.g. 'why BYU?', 'tell me about UVU', 'would I fit in at Utah?', 'my chances at Utah'. For deeper culture/vibe color, pair it with web_lookup.",
        parameters: {
          type: Type.OBJECT,
          properties: { school: { type: Type.STRING, description: "the school name the student mentioned" } },
          required: ["school"],
        },
      },
      {
        name: "web_lookup",
        description:
          "Search the live web for things our seeded data can't tell you — what campus life and student culture are really like, whether a student with their interests would FIT IN and find their people, clubs/community for a specific passion, vibe and traditions, recent program or admissions news. Use this to add real, current color about belonging and culture for a school the student cares about, or to answer any question our data doesn't cover. Pass a focused query naming the school and what the student cares about.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "focused search, e.g. 'BYU student life for a shy first-gen biology major — clubs, culture, fitting in'" },
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

DON'T BE GREEDY WITH SCHOOLS: presenting the ranked list is a big moment — don't dump it unprompted. Once you have enough to find good matches (name, grade, location, an interest/major), OFFER first, e.g. "I think I've got enough to pull up a few schools that fit — want to see them?" Only call search_universities after they say yes, or if they directly ask to see schools. It's always fine to talk about a school by name or answer a question about ONE specific school (school_detail) — that's helpful info, not the big reveal. Once you've shown the list, don't keep re-running the search every turn; only refresh it if they ask or you offer again.

COLLEGE CREDIT: AP / dual-enrollment / IB can save money and time — capture each as a credit item. But ONLY ask about credits if you don't already know them (check KNOWN SO FAR first).

TOOLS — use the RIGHT one, and don't over-call:
- update_profile: whenever you learn ANY new fact.
- search_universities: presents the ranked list as cards — only after the student asked to see schools or said yes to your offer (see DON'T BE GREEDY above). Never for a single-school or general question, and not every turn.
- school_detail: when they ask about ONE named school ("why BYU?", "tell me about UVU", "would I fit in at Utah?", "my odds at Utah?"). This is how you answer with real numbers.
- web_lookup: pull LIVE info our data can't give — campus culture/vibe, whether they'd belong & find their people for their specific interest, clubs/community, recent news. Use it to make "would I fit in?" answers real and current; cite naturally ("students online say…"). Don't use it for numbers school_detail already has.
- find_scholarships: when they ask about scholarships, aid, or paying for college.
- add_task: real deadlines. If they need aid → key:"fafsa". Don't re-add a task that's already on their list.

USE TOOL RESULTS — being specific is the difference between helpful and useless:
- After search_universities: name your top 1-2 schools and say WHY using their match %, net price (in dollars/yr after aid), and one concrete reason or evidence item. e.g. "BYU's your top match at 96% — about $13k/yr after aid, and students rate it 4.4/5 for its nursing pipeline." Surface a real "watch out" if one came back.
- After school_detail: lead with how it fits THEIR interests (the match % + a concrete why tied to what they care about) and whether they'd BELONG (student-life signals / what students love it for), then their CHANCES of getting in. Bring up net price + rating as support, not the headline — a sophomore cares about fitting in and getting in at least as much as cost. If there's a caution, say it honestly. If they're asking about culture/vibe/fitting in and you want real color, call web_lookup.
- After web_lookup: weave the findings into a warm, specific answer about belonging/culture; attribute lightly ("students say…") and never invent details it didn't return.
- After find_scholarships: NAME the actual scholarships you got back (don't just say "some options") with a one-line why for each.

NEVER INVENT NUMBERS. Only state stats a tool actually gave you (match %, net price, acceptance odds, RateMyProfessor rating). Do NOT make up admit rates, board-pass rates, salaries, or aid amounts — if you don't have the number, speak qualitatively. Banned filler with no specifics: "super respected", "fantastic choice", "great program", "world-class".

DON'T REPEAT YOURSELF: never re-ask something already in KNOWN SO FAR or the history. If you know their AP score, use it. Ask about AP/dual-enrollment at most once, ever. Mention the pre-med "don't skip core science with AP" caution at MOST once, and only when actually discussing pre-med / that credit decision — never in scholarship, sport, or general chat. If profile completeness is ≥ 75%, stop interrogating and guide with data.

Keep replies to 2-4 sentences, plain and warm. Answer the actual question FIRST, then at most ONE fresh follow-up (only if it helps) — don't default to FAFSA/AP every turn.`;
}

export interface AgentResult {
  reply: string;
  updates: ProfileUpdates;
  tasks: TaskItem[];
  revealMatches: boolean;
  toolsUsed: string[];
  toolEvents: ToolEvent[]; // visible "agent did X" lines for the chat
}

// Apply update_profile args onto a working copy so later tools see latest data.
function mergeWorking(w: StudentProfile, a: Record<string, unknown>) {
  const scalar = ["name", "grade", "highSchool", "city", "state", "zip", "firstGen", "careerGoal", "settingPref", "sizePref", "maxBudget", "needsAid", "stayInState"] as const;
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

  const completeness = profileCompleteness(working);
  const enoughToSearch =
    !!working.name && !!working.grade && !!(working.city || working.state || working.zip) &&
    (working.interestSignals.length >= 1 || working.intendedMajors.length >= 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    {
      role: "user",
      parts: [{
        text: `${profileSummary(working)}\nProfile completeness: ${completeness}%. readyToOfferSchools=${enoughToSearch} (if true and they haven't asked to see schools, OFFER — don't auto-present).${opts.speak === false ? " (Reading a spoken transcript — call tools but keep reply empty.)" : ""}\n\nStudent: ${opts.message}`,
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
      if (call.name === "update_profile") {
        Object.assign(updates, args);
        mergeWorking(working, args);
      } else if (call.name === "search_universities") {
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
        result = { matches: top };
        // Cards the chat renders inline (the student stays in the conversation).
        toolEvents.push({ kind: "search", label: "Right-fit schools", detail: `${ranked.length} found`, schools: ranked.map((m) => ({ schoolId: m.schoolId, matchPct: m.overallFit })) });
      } else if (call.name === "school_detail") {
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
          result = { error: `No data for "${args.school}". Suggest one of the matched schools instead.` };
        }
      } else if (call.name === "web_lookup") {
        const q = String(args.query ?? "").trim();
        const { answer, sources } = await webLookup(ai, q);
        result = { answer, sources };
        toolEvents.push({ kind: "web", label: "Searching the web", detail: String(args.school || q).slice(0, 48), items: sources.map((s) => ({ title: s.title || s.url, sub: s.url })) });
      } else if (call.name === "find_scholarships") {
        const found = findScholarships(working);
        result = { scholarships: found };
        toolEvents.push({ kind: "scholarship", label: "Scholarships for you", detail: `${found.length} found`, items: found.map((f) => ({ title: f.name, sub: f.why })) });
      } else if (call.name === "add_task") {
        const t = makeTask(args as { key?: string; title?: string; detail?: string; due?: string }, working.grade);
        tasks.push(t);
        working.tasks.push(t);
        result = { added: { title: t.title, due: t.due } };
        toolEvents.push({ kind: "task", label: "Added to your tasks", detail: t.title });
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

  return { reply, updates, tasks, revealMatches, toolsUsed, toolEvents };
}
