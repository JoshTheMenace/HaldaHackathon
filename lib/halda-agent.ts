import { GoogleGenAI, Type } from "@google/genai";
import type { StudentProfile, TaskItem, ToolEvent } from "./types";
import { profileCompleteness } from "./match";
import { rankInterestMatches } from "./interest-match";
import { schoolById } from "./schools";
import { makeTask } from "./deadlines";
import { findScholarships } from "./scholarships";
import { profileSummary, type ProfileUpdates } from "./halda-prompt";

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
          "Search right-fit universities. Call this once you know the basics (name, grade, location, and at least one interest with its intent). The student will SEE the ranked matches appear.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            emphasize: { type: Type.STRING, description: "optional weight, e.g. 'affordability', 'film', 'graduate early'" },
          },
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

Naturally pick up everything that helps: high school, whether they'd be first-gen, campus setting/size, and money reality (budget / needs aid). Save it with update_profile as you go. If a student names their high school but not their city, infer the likely city + state from the school name (e.g. "Austin High School" -> Austin, TX) and save those too as a best estimate.

LOCATION MATTERS: if the student says they want to stay in-state or close to home (e.g. "stay in Utah"), set stayInState=true AND save state (e.g. "UT"), then re-run search_universities so the matches actually show in-state schools first. A single named major (e.g. "biology") is enough to start searching — you don't need a separate interest.

ALSO ask about COLLEGE CREDIT: AP classes, dual/concurrent enrollment, IB. It matters because it can save them money and time — capture each as a credit item.

TOOLS — use them, don't just talk:
- update_profile: whenever you learn ANY fact (name, grade, location, interests+intent, major, money reality, AP/dual-enrollment credits).
- search_universities: the moment you know the basics (name, grade, location, ≥1 interest with intent). Do it proactively — the student sees matches appear. Re-run it if big new info changes things.
- find_scholarships: when they ask about scholarships, aid, or paying for college, call it — they'll see the matched results.
- add_task: put real deadlines on their list. If they need aid → add_task key:"fafsa". You can also add psat, common_app, college_list, etc. when relevant.

Know when you have ENOUGH: once basics are in, search and shift from interrogating to guiding (matches, money, next steps). Don't keep asking endless questions. Keep replies to 1-3 sentences.`;
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
    working.interestSignals.length >= 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    {
      role: "user",
      parts: [{
        text: `${profileSummary(working)}\nProfile completeness: ${completeness}%. enoughToSearch=${enoughToSearch}.${opts.speak === false ? " (Reading a spoken transcript — call tools but keep reply empty.)" : ""}\n\nStudent: ${opts.message}`,
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
      const args = (call.args ?? {}) as Record<string, unknown>;
      let result: unknown = { ok: true };
      if (call.name === "update_profile") {
        Object.assign(updates, args);
        mergeWorking(working, args);
      } else if (call.name === "search_universities") {
        revealMatches = true;
        const top = rankInterestMatches(working, 4).map((m) => {
          const s = schoolById(m.schoolId)!;
          return { school: s.short, fit: m.overallFit, why: m.reasons[0] ?? s.vibe };
        });
        result = { matches: top };
        toolEvents.push({ kind: "search", label: "Searching right-fit schools", detail: `${top.length} matches` });
      } else if (call.name === "find_scholarships") {
        const found = findScholarships(working);
        result = { scholarships: found };
        toolEvents.push({ kind: "scholarship", label: "Looking up scholarships", detail: `${found.length} found` });
      } else if (call.name === "add_task") {
        const t = makeTask(args as { key?: string; title?: string; detail?: string; due?: string }, working.grade);
        tasks.push(t);
        working.tasks.push(t);
        result = { added: { title: t.title, due: t.due } };
        toolEvents.push({ kind: "task", label: "Added to your tasks", detail: t.title });
      }
      toolsUsed.push(call.name ?? "?");
      responseParts.push({ functionResponse: { name: call.name, response: result as object } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { reply, updates, tasks, revealMatches, toolsUsed, toolEvents };
}
