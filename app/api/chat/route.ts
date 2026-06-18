import { NextResponse } from "next/server";
import { respond } from "@/lib/agent";
import { getStudent, upsertStudent } from "@/lib/store";
import type { StudentProfile } from "@/lib/types";

// The multi-channel brain, server-side. The SAME deterministic engine powers
// web, SMS, and email — channel is just transport. Deterministic BY DESIGN:
// no API key, no network dependency, identical output every run → zero demo
// risk on stage. State (profile, XP, quests) is the engine's source of truth.
//
// Body: { profile?, studentId?, message, turn, channel, revealed? }
export async function POST(req: Request) {
  const { profile, studentId, message, turn, channel, revealed } =
    (await req.json()) as {
      profile?: StudentProfile;
      studentId?: string;
      message: string;
      turn: number;
      channel?: string;
      revealed?: boolean;
    };

  // Resolve the student record from the store (proves cross-channel state lives
  // in one place) or accept an inline profile.
  const base = profile ?? (studentId ? getStudent(studentId) : undefined);
  if (!base) {
    return NextResponse.json({ error: "profile or studentId required" }, { status: 400 });
  }

  const result = respond(base, message, turn ?? 0, revealed ?? false);

  // Persist the enrichment so the very next channel sees it.
  const next: StudentProfile = {
    ...base,
    ...result.patch,
    interests: result.patch.interests ?? base.interests,
    intendedMajors: result.patch.intendedMajors ?? base.intendedMajors,
    updatedAt: Date.now(),
  };
  upsertStudent(next);

  return NextResponse.json({ engine: "deterministic", channel: channel ?? "web", ...result });
}
