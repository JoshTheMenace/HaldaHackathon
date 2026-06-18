import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { scoreInterestFit } from "@/lib/interest-match";
import { scorecardLookup } from "@/lib/scorecard";
import { SCHOOLS } from "@/lib/schools";
import type { School, StudentProfile } from "@/lib/types";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => clean(s).split(" ").filter((t) => t.length > 2 && !["the", "of", "at", "and", "university", "college"].includes(t));

function resolveSchool(q: string): School | undefined {
  const n = clean(q);
  if (!n) return undefined;
  return (
    SCHOOLS.find((s) => clean(s.short) === n || clean(s.name) === n) ||
    SCHOOLS.find((s) => n.includes(clean(s.short)) || clean(s.name).includes(n)) ||
    SCHOOLS.find((s) => tokens(n).some((t) => clean(s.name).includes(t) || clean(s.short).includes(t)))
  );
}

async function webResearch(school: string, question: string, profile?: StudentProfile) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  const interest = profile?.intendedMajors?.[0] || profile?.interestSignals?.[0]?.interest || "";
  const query = `${school} ${question || `student fit and program quality ${interest}`}`.trim();
  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `${query}\n\nAnswer for a high-school student in 2-4 concise sentences. Focus on current program/culture evidence, especially whether this school is strong for the student's question. Do not invent admissions numbers; hard facts come separately from College Scorecard/catalog data.`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: { tools: [{ googleSearch: {} }] as any, temperature: 0.2 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return {
    answer: res.text ?? "",
    sources: chunks
      .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
      .filter((s) => s.url)
      .slice(0, 4),
  };
}

export async function POST(req: Request) {
  const { school, question, profile } = (await req.json()) as {
    school?: string;
    question?: string;
    profile?: StudentProfile;
  };
  if (!school?.trim()) return NextResponse.json({ error: "school is required" }, { status: 400 });

  const catalog = resolveSchool(school);
  const official = await scorecardLookup(catalog?.name ?? school);
  const schoolName = official?.name ?? catalog?.name ?? school;
  const web = await webResearch(schoolName, question ?? "", profile);
  const fit = catalog && profile ? scoreInterestFit(profile, catalog) : null;

  return NextResponse.json({
    school: schoolName,
    media: {
      campusImage: `/api/school-media?school=${encodeURIComponent(schoolName)}&kind=campus`,
      logoImage: `/api/school-media?school=${encodeURIComponent(schoolName)}&kind=logo`,
      source: "live Wikipedia/Wikimedia lookup",
    },
    catalog: catalog ? {
      id: catalog.id,
      short: catalog.short,
      location: `${catalog.city}, ${catalog.state}`,
      acceptanceRatePct: Math.round(catalog.acceptanceRate * 100),
      netPricePerYearAfterAid: catalog.netPrice,
      size: catalog.size,
      setting: catalog.setting,
      strongMajors: catalog.strongMajors,
      vibe: catalog.vibe,
      source: "Halda catalog",
    } : null,
    scorecard: official ? {
      location: [official.city, official.state].filter(Boolean).join(", ") || undefined,
      acceptanceRatePct: official.acceptanceRate != null ? Math.round(official.acceptanceRate * 100) : undefined,
      netPricePerYearAfterAid: official.netPrice,
      undergradSize: official.size,
      gradRatePct: official.completionRate != null ? Math.round(official.completionRate * 100) : undefined,
      medianEarnings10yr: official.medianEarnings,
      source: "College Scorecard",
    } : null,
    fit: fit ? {
      matchPct: fit.overallFit,
      reasons: fit.reasons.slice(0, 3),
      concerns: fit.concerns.slice(0, 2),
      creditFit: fit.creditFit.level,
    } : null,
    web,
  });
}
