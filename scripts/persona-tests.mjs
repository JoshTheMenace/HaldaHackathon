// Drives 10 persona-driven conversations against the live agent and writes a
// readable transcript (with tool calls) to /tmp/halda-persona-tests.md.
import { writeFileSync } from "node:fs";

const API = "http://localhost:3000/api/gemini";

const baseProfile = () => ({
  // no `id` → skip the partner-store write, keep tests pure-agent
  interests: [], interestSignals: [], intendedMajors: [], tasks: [], creditWallet: [],
  savedSchoolIds: [], xp: 0, streak: 1, completedQuests: [], badges: [], channelsLinked: ["web"],
  consent: { fields: ["name", "grade", "location", "interests", "major", "goal"], shareWithPartners: true },
  createdAt: 0, updatedAt: 0,
});

function merge(p, u) {
  if (!u) return;
  const scalar = ["name", "grade", "highSchool", "city", "state", "zip", "firstGen", "careerGoal", "settingPref", "sizePref", "maxBudget", "needsAid", "stayInState"];
  for (const k of scalar) if (u[k] !== undefined) p[k] = u[k];
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

const PERSONAS = [
  { name: "1. Cold start (gradual reveal)", strategy: "Says little at first; name/grade/interest dribble out over turns. Tests the COLD-START open + not over-asking.",
    turns: ["hey", "I'm Jordan, a sophomore", "I really like biology and want to stay in Utah", "yeah show me some schools"] },
  { name: "2. Niche interest — film", strategy: "Wants a specialized program we have NO seeded data for. Tests search-first / web_lookup, naming real schools.",
    turns: ["I want to go to a really good film school", "I'm Ava, a junior in Provo, Utah", "where should I look?", "are any of those actually affordable?"] },
  { name: "3. First-gen, money-tight nurse", strategy: "Cost-sensitive, first-gen, location-locked. Tests scholarships, FAFSA task, in-state ranking.",
    turns: ["Hi, I'm Sofia, a sophomore. I'd be first in my family to go to college and money is really tight.", "I want to be a nurse and stay near home in Texas", "what scholarships could actually help me?", "ok show me some schools"] },
  { name: "4. Totally undecided", strategy: "No major, vague interests. Tests open-ended handling without forcing a bad match.",
    turns: ["I'm Liam, a sophomore, honestly I have no clue what I want to do", "I guess I like video games and hanging out with friends", "I'm in Ohio and don't want to spend a fortune", "ok what schools fit?"] },
  { name: "5. AP credit optimizer (graduate early)", strategy: "Lots of AP credit, wants to save time/money. Tests Credit Wallet + credit-fit ranking.",
    turns: ["I'm Noah, a junior in Mesa, Arizona. I have a ton of AP credit and want to graduate early to save money.", "AP Bio, AP Calc, AP Chem, AP English — all 4s and 5s", "I want to study computer science", "which schools let me use the most of my credit?"] },
  { name: "6. High-achiever reach (beyond our data)", strategy: "Elite stats, names MIT/Stanford. Tests honesty about chances + web_lookup for schools beyond the 17.",
    turns: ["I'm Priya, a junior, 4.0 GPA and 1540 SAT. I want top engineering schools like MIT and Stanford.", "I'm in California and cost isn't a big concern", "what are my real chances, and what else should I consider?"] },
  { name: "7. Belonging / fit-in", strategy: "Shy, first-gen, asks about culture. Tests school_detail + web_lookup belonging color, not just cost.",
    turns: ["I'm Maya, a sophomore in Provo. I'm pretty shy and would be first-gen.", "Would I actually fit in at BYU? Will I find my people studying nursing?", "what about UVU instead?"] },
  { name: "8. Adversarial / resistant", strategy: "One-word, unhelpful answers. Tests graceful handling, not nagging, extracting from scraps.",
    turns: ["idk", "school is whatever", "maybe sports i guess", "fine, I'm in Florida"] },
  { name: "9. Conflicting constraints", strategy: "Marine biology but landlocked, broke, stay-home. Tests honest tradeoff handling.",
    turns: ["I'm Ethan, a sophomore in Denver, Colorado. I love marine biology but can't afford much and want to stay close to home.", "is that even realistic from here?", "what would you actually recommend?"] },
  { name: "10. Rapid-fire multi-fact", strategy: "Dumps many facts in one breath (voice-style). Tests multi-extraction + brevity.",
    turns: ["hey im Zoe a sophomore from Austin texas i wanna do something with art and design and stay in state", "yeah pull up some schools", "which is the cheapest one"] },
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
  const out = [`## ${p.name}`, `_Strategy: ${p.strategy}_`, ""];
  for (const msg of p.turns) {
    let d;
    try { d = await turn(profile, [...history], msg); } catch (e) { d = { error: String(e) }; }
    history.push({ role: "user", text: msg });
    history.push({ role: "model", text: d.reply || "" });
    merge(profile, d.updates);
    const tools = (d.toolsUsed && d.toolsUsed.length) ? d.toolsUsed.join(", ") : "none";
    const events = (d.toolEvents || []).map((e) => `${e.kind}:${e.label}${e.detail ? ` (${e.detail})` : ""}`).join(" | ");
    out.push(`> **Student:** ${msg}`);
    out.push(`> _tools: ${tools}${events ? ` — ${events}` : ""}${d.error ? ` — ERROR: ${d.error}` : ""}_`);
    out.push(`**Halda:** ${d.reply || "(no reply)"}`);
    out.push("");
  }
  out.push(`_Final profile: ${JSON.stringify({ name: profile.name, grade: profile.grade, loc: [profile.city, profile.state].filter(Boolean).join(", "), majors: profile.intendedMajors, interests: profile.interestSignals.map((s) => s.interest), credits: profile.creditWallet.length, stayInState: profile.stayInState, needsAid: profile.needsAid, budget: profile.maxBudget })}_`);
  out.push("\n---\n");
  return out.join("\n");
}

const sections = [];
for (const p of PERSONAS) {
  process.stderr.write(`Running ${p.name}…\n`);
  sections.push(await runPersona(p));
}
const md = `# Halda — 10 Persona Test Transcripts\n\n${sections.join("\n")}`;
writeFileSync("/tmp/halda-persona-tests.md", md);
process.stderr.write("Wrote /tmp/halda-persona-tests.md\n");
