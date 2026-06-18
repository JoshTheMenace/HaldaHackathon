import { NextResponse } from "next/server";
import { getStudent, upsertStudent } from "@/lib/store";
import type { StudentProfile } from "@/lib/types";

// Account creation + live sync. The student owns this record; it is never
// handed to a tenant wholesale — only a scored, masked Lead is.
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<StudentProfile>;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const profile: StudentProfile = {
    id: body.id,
    name: body.name,
    zip: body.zip,
    city: body.city,
    state: body.state,
    highSchool: body.highSchool,
    grade: body.grade,
    interests: body.interests ?? [],
    interestSignals: body.interestSignals ?? [],
    intendedMajors: body.intendedMajors ?? [],
    tasks: body.tasks ?? [],
    creditWallet: body.creditWallet ?? [],
    careerGoal: body.careerGoal,
    settingPref: body.settingPref,
    sizePref: body.sizePref,
    maxBudget: body.maxBudget,
    needsAid: body.needsAid,
    firstGen: body.firstGen,
    xp: body.xp ?? 0,
    streak: body.streak ?? 0,
    completedQuests: body.completedQuests ?? [],
    badges: body.badges ?? [],
    channelsLinked: body.channelsLinked ?? ["web"],
    consent: body.consent ?? {
      fields: ["name", "grade", "location", "interests", "major", "goal"],
      shareWithPartners: true,
    },
    createdAt: body.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  upsertStudent(profile);
  return NextResponse.json({ ok: true, profile });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const p = getStudent(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ profile: p });
}
