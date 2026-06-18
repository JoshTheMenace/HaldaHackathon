import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const SCORECARD_API_KEY = "d8HZTfK9z7TgLgeVdmjVeprkU5AcamdUQe7P7VuF";
const SCORECARD_BASE = "https://api.data.gov/ed/collegescorecard/v1/schools.json";
const SCORECARD_FIELDS = [
  "id", "school.name", "school.city", "school.state", "school.school_url", "school.ownership",
  "latest.admissions.admission_rate.overall", "latest.student.size",
  "latest.admissions.sat_scores.25th_percentile.evidence_based_reading_and_writing",
  "latest.admissions.sat_scores.75th_percentile.evidence_based_reading_and_writing",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.admissions.act_scores.25th_percentile.cumulative",
  "latest.admissions.act_scores.75th_percentile.cumulative",
  "latest.completion.rate_suppressed.overall",
  "latest.cost.avg_net_price.overall",
  "latest.aid.pell_grant_rate",
  "latest.student.share_firstgeneration",
  "latest.earnings.6_yrs_after_entry.median",
].join(",");

const OWNERSHIP_MAP: Record<number, string> = { 1: "public", 2: "private_nonprofit", 3: "private_forprofit" };

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "university";
}

async function fetchScorecard(query: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    api_key: SCORECARD_API_KEY,
    "school.name": query,
    fields: SCORECARD_FIELDS,
    _per_page: "3",
  });
  const resp = await fetch(`${SCORECARD_BASE}?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) return null;
  const data = await resp.json() as { results?: Record<string, unknown>[] };
  return data.results?.[0] ?? null;
}

function parseScorecard(raw: Record<string, unknown>): Record<string, unknown> {
  const g = (k: string) => raw[k];
  const selectivity: Record<string, number> = {};
  const rate = g("latest.admissions.admission_rate.overall");
  const size = g("latest.student.size");
  if (rate != null) selectivity.acceptance_rate = Math.round(parseFloat(String(rate)) * 10000) / 10000;
  if (size != null) selectivity.enrollment = parseInt(String(size));
  for (const [short, field] of [
    ["sat_erw_25", "latest.admissions.sat_scores.25th_percentile.evidence_based_reading_and_writing"],
    ["sat_erw_75", "latest.admissions.sat_scores.75th_percentile.evidence_based_reading_and_writing"],
    ["sat_math_25", "latest.admissions.sat_scores.25th_percentile.math"],
    ["sat_math_75", "latest.admissions.sat_scores.75th_percentile.math"],
    ["act_25", "latest.admissions.act_scores.25th_percentile.cumulative"],
    ["act_75", "latest.admissions.act_scores.75th_percentile.cumulative"],
  ]) {
    const v = g(field);
    if (v != null) selectivity[short] = parseInt(String(v));
  }
  const outcomes: Record<string, number> = {};
  for (const [short, field] of [
    ["graduation_rate_4yr", "latest.completion.rate_suppressed.overall"],
    ["avg_net_price", "latest.cost.avg_net_price.overall"],
    ["pell_grant_rate", "latest.aid.pell_grant_rate"],
    ["first_gen_share", "latest.student.share_firstgeneration"],
    ["median_earnings_6yr", "latest.earnings.6_yrs_after_entry.median"],
  ]) {
    const v = g(field);
    if (v != null) outcomes[short] = parseFloat(String(v));
  }
  const ownershipNum = g("school.ownership") as number;
  return {
    unitid: String(g("id") || ""),
    location: { city: String(g("school.city") || ""), state: String(g("school.state") || "") },
    type: OWNERSHIP_MAP[ownershipNum] || "unknown",
    url: String(g("school.school_url") || ""),
    selectivity,
    outcomes,
  };
}

function buildClaudePrompt(name: string, scorecard: Record<string, unknown>): string {
  const factorKeys = [
    "rigor_of_coursework", "gpa", "class_rank", "test_scores",
    "application_essay", "recommendations", "extracurricular_activities",
    "talent_ability", "character_personal_qualities", "interview",
    "first_generation", "alumni_relation", "geographical_residence",
    "state_residency", "religious_affiliation", "racial_ethnic_status",
    "volunteer_work", "work_experience", "demonstrated_interest",
  ];
  const factorsSchema = JSON.stringify(
    Object.fromEntries(factorKeys.map((k) => [k, "Very Important | Important | Considered | Not Considered"])),
    null, 2
  );
  return `You are an expert on US college and university admissions policies and Common Data Set reports. Build a complete, accurate admissions profile for "${name}".

Quantitative data from College Scorecard (may be empty if school not in database):
${JSON.stringify(scorecard, null, 2)}

Generate accurate data reflecting how this institution actually evaluates applicants based on its published policies and Common Data Set. If unfamiliar with this specific school, make reasonable inferences from institution type, size, acceptance rate, and location.

Return ONLY valid JSON (no markdown fences, no text before or after):
{
  "admission_factors": ${factorsSchema},
  "policies": {
    "test_optional": <true|false>,
    "early_action": <true|false>,
    "early_decision": <true|false>,
    "common_app": <true|false>
  },
  "requirements": {
    "essays_required": <true|false>,
    "interview": "<Not offered | Optional | Recommended | Required>",
    "recommendations_required": <integer 0-4>,
    "additional_materials": ["<any special requirements, or empty array []>"]
  },
  "special_considerations": [
    "<Specific factual sentence about a unique admissions characteristic, mission, or policy>",
    "<Another specific characteristic, program, or student population detail>",
    "<Another>",
    "<Another>"
  ],
  "class_profile": {
    "hs_rank_top_10_pct": <float 0.0-1.0>,
    "hs_rank_top_25_pct": <float 0.0-1.0>,
    "gpa_4_0_plus": <float 0.0-1.0>,
    "gpa_3_75_to_3_99": <float 0.0-1.0>,
    "gpa_3_5_to_3_74": <float 0.0-1.0>,
    "source": "AI-estimated"
  },
  "financial_aid": {
    "need_blind": <true|false>,
    "meets_full_need": <true|false>,
    "no_loan_policy": <true|false>,
    "avg_need_based_aid": <integer dollars>,
    "merit_aid_available": <true|false>,
    "notes": "<2-3 sentences on financial aid policies, scholarships, and affordability>"
  }
}`;
}

export async function POST(req: Request) {
  const { name } = (await req.json()) as { name?: string };
  const trimmed = (name || "").trim();
  if (!trimmed || trimmed.length < 2) {
    return NextResponse.json({ error: "University name required" }, { status: 400 });
  }

  const collegesDir = path.join(process.cwd(), "lib/data/colleges");

  // Return if existing college matches by name
  for (const file of fs.readdirSync(collegesDir).filter((f) => f.endsWith(".json"))) {
    const college = JSON.parse(fs.readFileSync(path.join(collegesDir, file), "utf8")) as Record<string, unknown>;
    if ((college.name as string)?.toLowerCase() === trimmed.toLowerCase()) {
      return NextResponse.json(college);
    }
  }

  const slug = makeSlug(trimmed);
  const outPath = path.join(collegesDir, `${slug}.json`);
  if (fs.existsSync(outPath)) {
    return NextResponse.json(JSON.parse(fs.readFileSync(outPath, "utf8")));
  }

  // Fetch quantitative data
  let scorecardData: Record<string, unknown>;
  let officialName = trimmed;
  try {
    const raw = await fetchScorecard(trimmed);
    if (raw) {
      scorecardData = parseScorecard(raw);
      officialName = (raw["school.name"] as string) || trimmed;
    } else {
      scorecardData = { unitid: "", location: { city: "", state: "" }, type: "unknown", url: "", selectivity: {} };
    }
  } catch {
    scorecardData = { unitid: "", location: { city: "", state: "" }, type: "unknown", url: "", selectivity: {} };
  }

  // Build qualitative profile with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const client = new Anthropic({ apiKey });
  let qualitative: Record<string, unknown>;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: buildClaudePrompt(officialName, scorecardData) }],
    });
    let rawText = (message.content[0] as Anthropic.TextBlock).text.trim();
    if (rawText.startsWith("```")) {
      const parts = rawText.split("```");
      rawText = parts[1];
      if (rawText.startsWith("json")) rawText = rawText.slice(4);
      rawText = rawText.trim();
    }
    qualitative = JSON.parse(rawText) as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json({ error: `Failed to build committee profile: ${String(e)}` }, { status: 500 });
  }

  const profile = { name: officialName, slug, ...scorecardData, ...qualitative };
  try { fs.writeFileSync(outPath, JSON.stringify(profile, null, 2)); } catch { /* ignore */ }

  return NextResponse.json(profile);
}
