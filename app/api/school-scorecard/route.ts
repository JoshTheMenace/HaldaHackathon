import { NextResponse } from "next/server";
import { scorecardLookup } from "@/lib/scorecard";
import { SCHOOLS } from "@/lib/schools";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function resolveSchool(q: string) {
  const n = clean(q);
  return SCHOOLS.find((s) => clean(s.id) === n || clean(s.short) === n || clean(s.name) === n) ||
    SCHOOLS.find((s) => clean(s.name).includes(n) || clean(s.short).includes(n));
}

export async function GET(req: Request) {
  const school = new URL(req.url).searchParams.get("school")?.trim();
  if (!school) return NextResponse.json({ error: "school is required" }, { status: 400 });

  const catalog = resolveSchool(school);
  const official = await scorecardLookup(catalog?.name ?? school);
  return NextResponse.json({
    school: official?.name ?? catalog?.name ?? school,
    scorecard: official ? {
      location: [official.city, official.state].filter(Boolean).join(", ") || undefined,
      acceptanceRate: official.acceptanceRate,
      netPrice: official.netPrice,
      undergradSize: official.size,
      completionRate: official.completionRate,
      medianEarnings: official.medianEarnings,
      source: "College Scorecard",
    } : null,
  });
}
