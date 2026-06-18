// Golden-scenario harness: fire a set of realistic student questions at the
// live agent (/api/gemini) against the seeded Maya profile and capture what it
// replies, which tools it calls, and what it changes. Writes /tmp/golden.json.
//   node scripts/golden-scenarios.mjs   (dev server must be running on :3000)

import { writeFileSync } from "node:fs";

const MAYA = {
  id: "stu_maya", name: "Maya Reynolds", grade: 12, city: "Provo", state: "UT",
  highSchool: "Timpview High School", stayInState: true, needsAid: true, firstGen: true,
  intendedMajors: ["Nursing"], careerGoal: "Nurse Practitioner",
  interests: ["nursing", "healthcare", "tennis"],
  interestSignals: [
    { interest: "nursing", intent: "career_path", importance: "must_have" },
    { interest: "biology", intent: "major", importance: "high" },
    { interest: "tennis", intent: "serious_extracurricular", importance: "medium" },
  ],
  creditWallet: [{ id: "c1", source: "AP Biology", type: "ap", subject: "science", status: "completed", score: "4" }],
  tasks: [], xp: 0, streak: 1, completedQuests: [], badges: [], channelsLinked: ["web"],
  consent: { fields: [], shareWithPartners: true }, createdAt: 0, updatedAt: 0,
};

const SCENARIOS = [
  "What colleges should I be looking at?",
  "Why is BYU a good fit for me?",
  "Can you help me find scholarships? Money is tight.",
  "What's my next deadline?",
  "I'm worried I can't afford college — what are my cheapest options?",
  "I've been rethinking things. What if I wanted to do pre-med instead of nursing?",
  "Can I play tennis in college if I'm not good enough to be recruited?",
  "Should I use my AP Bio credit to skip intro biology in college?",
  "What are my chances of getting into the University of Utah?",
  "Tell me about UVU — is it actually any good?",
];

const out = [];
for (const message of SCENARIOS) {
  try {
    const r = await fetch("http://localhost:3000/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "chat", message, profile: MAYA, history: [] }),
    });
    const d = await r.json();
    out.push({ message, reply: d.reply, toolsUsed: d.toolsUsed, toolEvents: d.toolEvents, updates: d.updates, tasks: (d.tasks || []).map((t) => t.title), revealMatches: d.revealMatches, error: d.error });
    console.log(`\n──────── Q: ${message}`);
    console.log(`tools: ${(d.toolsUsed || []).join(", ") || "none"}`);
    console.log(`reply: ${(d.reply || d.error || "").slice(0, 320)}`);
  } catch (e) {
    out.push({ message, error: String(e) });
    console.log(`\n──────── Q: ${message}\nERROR ${e}`);
  }
}
writeFileSync("/tmp/golden.json", JSON.stringify(out, null, 2));
console.log(`\nWrote ${out.length} scenarios → /tmp/golden.json`);
