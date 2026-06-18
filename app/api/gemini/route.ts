import { NextResponse } from "next/server";
import { runAgent } from "@/lib/halda-agent";
import { upsertStudent, appendHistory } from "@/lib/store";
import type { StudentProfile } from "@/lib/types";

// Halda's agentic brain (Gemini function-calling). Converses, extracts a
// structured intent-classified profile, decides when to search universities,
// and puts real deadlines (FAFSA, etc.) on the student's task list.
export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no GEMINI_API_KEY" }, { status: 500 });

  const { history, message, profile, mode } = (await req.json()) as {
    history?: { role: "user" | "model"; text: string }[];
    message: string;
    profile: StudentProfile;
    mode?: "chat" | "extract";
  };

  try {
    const result = await runAgent({
      apiKey,
      profile,
      message,
      history,
      speak: mode !== "extract",
    });
    // Persist so the partner console + next channel see the enrichment.
    if (profile?.id) {
      const merged: StudentProfile = {
        ...profile,
        ...result.updates,
        intendedMajors: result.updates.intendedMajors ?? profile.intendedMajors,
        updatedAt: Date.now(),
      } as StudentProfile;
      upsertStudent(merged);
      // Record the turn in the shared transcript so an SMS handoff continues it.
      appendHistory(profile.id, [
        { role: "user", text: message, channel: "web" },
        ...(result.reply ? [{ role: "model" as const, text: result.reply, channel: "web" as const }] : []),
      ]);
    }
    return NextResponse.json({ engine: "gemini-agent", ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, reply: "", updates: {}, tasks: [], revealMatches: false }, { status: 502 });
  }
}
