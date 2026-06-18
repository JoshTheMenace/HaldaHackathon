import { NextResponse } from "next/server";
import { SCHOOLS } from "@/lib/schools";
import { ratingFor } from "@/lib/ratings";

// Every seeded school merged with its real (cached) RateMyProfessor rating.
// A stable read-only contract for the student-facing UI to consume.
export function GET() {
  const data = SCHOOLS.map((s) => ({ ...s, rating: ratingFor(s.id) ?? null }));
  return NextResponse.json(data);
}
