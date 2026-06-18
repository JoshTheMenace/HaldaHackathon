// The 6 OFFICIAL hackathon-brief personas, run against the live agent (/api/gemini).
// Each must return a MEANINGFULLY different experience. Writes /tmp/brief-personas.md.
//   node --env-file=.env.local scripts/brief-personas.mjs   (server must be on :3000)
import { writeFileSync } from "node:fs";

const API = "http://localhost:3000/api/gemini";

const baseProfile = () => ({
  interests: [], interestSignals: [], intendedMajors: [], tasks: [], creditWallet: [],
  savedSchoolIds: [], xp: 0, streak: 1, completedQuests: [], badges: [], channelsLinked: ["web"],
  consent: { fields: ["name", "grade", "location", "interests", "major", "goal"], shareWithPartners: true },
  createdAt: 0, updatedAt: 0,
});

function merge(p, u) {
  if (!u) return;
  const scalar = ["name", "grade", "highSchool", "city", "state", "zip", "firstGen", "isTransfer", "worksFullTime", "currentCollege", "completedCollegeYears", "associateDegree", "transferCreditsConcern", "country", "visaNeed", "internationalAidNeed", "careerGoal", "settingPref", "sizePref", "maxBudget", "needsAid", "stayInState"];
  for (const k of scalar) if (u[k] !== undefined) p[k] = u[k];
  if (Array.isArray(u.targetSchools)) p.targetSchools = [...new Set([...(p.targetSchools || []), ...u.targetSchools])];
  if (Array.isArray(u.chosenSchools)) p.targetSchools = [...new Set([...(p.targetSchools || []), ...u.chosenSchools])];
  if (Array.isArray(u.intendedMajors)) p.intendedMajors = [...new Set([...p.intendedMajors, ...u.intendedMajors])];
  if (Array.isArray(u.interestSignals)) {
    for (const s of u.interestSignals) {
      const i = p.interestSignals.findIndex((x) => x.interest.toLowerCase() === s.interest.toLowerCase());
      if (i >= 0) p.interestSignals[i] = { ...p.interestSignals[i], ...s };
      else p.interestSignals.push(s);
    }
  }
  if (Array.isArray(u.creditItems)) for (const c of u.creditItems) p.creditWallet.push({ ...c, id: `cr_${p.creditWallet.length}` });
}

function mergeTasks(p, tasks) {
  if (!Array.isArray(tasks)) return;
  const have = new Set(p.tasks.map((t) => t.key || t.title));
  for (const t of tasks) if (!have.has(t.key || t.title)) p.tasks.push(t);
}

const PERSONAS = [
  { name: "01. Maya, 17 — First-gen nursing", need: "Needs the agent to LEAD. Cap ~$15K/yr. No idea where to start.",
    turns: ["hi", "I'm Maya, I'm 17", "I want to study nursing but I honestly have no idea where to start, and my family can't pay more than about $15,000 a year", "ok lead the way — what should I do?"] },
  { name: "02. Caleb, 18 — High achiever CS", need: "3.9 GPA, top-20 CS, comparing 6 schools. Wants DATA not encouragement.",
    turns: ["I'm Caleb, a senior with a 3.9 GPA. I want computer science at a top-20 school.", "I'm comparing MIT, Stanford, CMU, UC Berkeley, Georgia Tech, and UIUC. Give me the data, not a pep talk.", "which has the best CS outcomes and return on investment?"] },
  { name: "03. Rosa, 24 — Transfer", need: "2yr community college, working full-time. MUST know if credits transfer before applying.",
    turns: ["I'm Rosa, I'm 24. I've finished two years at community college and I work full time.", "Before I apply anywhere I need to know whether my credits will actually transfer.", "I have an associate's in general studies — where can I finish a bachelor's without losing credits?"] },
  { name: "04. Devon, 16 — Career-first", need: "Environmental science but unsure it's a real career. Agent should lead with CAREER, not schools.",
    turns: ["I'm Devon, I'm 16. I think I might be into environmental science?", "is that even a real career though? what would I actually do day to day, and what does it pay?", "ok so what should I be doing right now at 16?"] },
  { name: "05. Anika, 17 — International (India)", need: "Applying from India. Visa-friendly schools, strong CS, scholarships for international students.",
    turns: ["I'm Anika, I'm 17 and applying from India. I want to study computer science in the US.", "I need schools that are genuinely good for international students and that offer scholarships to non-citizens.", "what about visa support and how much it'll really cost me as an international student?"] },
  { name: "06. Jordan, 15 — Sophomore", need: "No clue. Wants to know what to do NOW to keep options open + a reason to come back next month.",
    turns: ["I'm Jordan, I'm 15, a sophomore. I have no clue where I want to go.", "what should I even be doing right now to keep my options open?", "why would I come back next month — what's in it for me?"] },
];

async function turn(profile, history, message) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", message, history, profile }),
  });
  return r.json();
}

async function runPersona(p) {
  const profile = baseProfile();
  const history = [];
  const seen = { tools: [], events: [], replies: [] };
  const out = [`## ${p.name}`, `_Need: ${p.need}_`, ""];
  for (const msg of p.turns) {
    let d;
    try { d = await turn(profile, [...history], msg); } catch (e) { d = { error: String(e) }; }
    history.push({ role: "user", text: msg });
    history.push({ role: "model", text: d.reply || "" });
    merge(profile, d.updates);
    mergeTasks(profile, d.tasks);
    seen.tools.push(...(d.toolsUsed || []));
    seen.events.push(...(d.toolEvents || []));
    seen.replies.push(d.reply || "");
    const tools = (d.toolsUsed && d.toolsUsed.length) ? d.toolsUsed.join(", ") : "none";
    const events = (d.toolEvents || []).map((e) => `${e.kind}:${e.label}${e.detail ? ` (${e.detail})` : ""}`).join(" | ");
    out.push(`> **${p.name.split("—")[0].trim()}:** ${msg}`);
    out.push(`> _tools: ${tools}${events ? ` — ${events}` : ""}${d.error ? ` — ERROR: ${d.error}` : ""}_`);
    out.push(`**Halda:** ${d.reply || "(no reply)"}`);
    out.push("");
  }
  const failure = assertPersona(p.name, profile, seen);
  if (failure) out.push(`_ASSERTION FAILED: ${failure}_`, "");
  out.push(`_Final profile: ${JSON.stringify({ name: profile.name, grade: profile.grade, loc: [profile.city, profile.state].filter(Boolean).join(", "), majors: profile.intendedMajors, interests: profile.interestSignals.map((s) => s.interest), goal: profile.careerGoal, credits: profile.creditWallet.length, transfer: profile.isTransfer, worksFullTime: profile.worksFullTime, country: profile.country, visaNeed: profile.visaNeed, internationalAidNeed: profile.internationalAidNeed, targetSchools: profile.targetSchools, tasks: profile.tasks.length, stayInState: profile.stayInState, needsAid: profile.needsAid, budget: profile.maxBudget })}_`);
  out.push("\n---\n");
  return { section: out.join("\n"), failure };
}

function assertPersona(name, profile, seen) {
  const text = seen.replies.join("\n").toLowerCase();
  const eventKinds = seen.events.map((e) => e.kind);
  const fail = (msg) => `${name}: ${msg}`;
  if (name.includes("Maya") && !(profile.needsAid && (profile.maxBudget || text.includes("fafsa") || seen.tools.includes("find_scholarships"))))
    return fail("must preserve affordability and give FAFSA/scholarship guidance");
  if (name.includes("Caleb") && !(seen.tools.includes("compare_schools") || eventKinds.includes("compare") || (profile.targetSchools || []).length >= 4))
    return fail("must produce a comparison artifact and preserve targetSchools");
  if (name.includes("Rosa") && !(profile.isTransfer && profile.transferCreditsConcern && profile.worksFullTime))
    return fail("must preserve transfer, credit concern, and full-time work state");
  if (name.includes("Anika") && !(profile.country && profile.visaNeed && profile.internationalAidNeed))
    return fail("must preserve international country, visa, and aid state");
  if (name.includes("Jordan") && !(profile.tasks.length || seen.tools.includes("add_task") || /next month|come back|check in|return/.test(text)))
    return fail("must create a return trigger");
  return null;
}

const sections = [];
const failures = [];
for (const p of PERSONAS) {
  process.stderr.write(`Running ${p.name}…\n`);
  const result = await runPersona(p);
  sections.push(result.section);
  if (result.failure) failures.push(result.failure);
}
writeFileSync("/tmp/brief-personas.md", `# Halda — Official Brief Personas (live agent)\n\n${sections.join("\n")}`);
process.stderr.write("Wrote /tmp/brief-personas.md\n");
if (failures.length) {
  process.stderr.write(`Persona assertions failed:\n${failures.map((f) => `- ${f}`).join("\n")}\n`);
  process.exitCode = 1;
}
