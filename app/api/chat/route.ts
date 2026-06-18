import { NextResponse } from "next/server";
import { respond } from "@/lib/agent";
import { runAgent } from "@/lib/halda-agent";
import { getStudent, upsertStudent, getHistory, appendHistory } from "@/lib/store";
import type { StudentProfile } from "@/lib/types";

// Multi-channel AI brain. Uses Gemini when GEMINI_API_KEY is set, falls back
// to the deterministic engine so the demo never dies on missing credentials.
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

  const base = profile ?? (studentId ? getStudent(studentId) : undefined);
  if (!base) {
    return NextResponse.json({ error: "profile or studentId required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const history = getHistory(base.id).map((t) => ({
        role: t.role as "user" | "model",
        text: t.text,
      }));

      const result = await runAgent({ apiKey, profile: base, message, history, speak: true });

      const next: StudentProfile = {
        ...base,
        ...(result.updates as Partial<StudentProfile>),
        intendedMajors: (result.updates as { intendedMajors?: string[] }).intendedMajors ?? base.intendedMajors,
        updatedAt: Date.now(),
      };
      upsertStudent(next);

      const reply = result.reply || "I'm still thinking — give me a moment and try again!";

      appendHistory(base.id, [
        { role: "user", text: message, channel: (channel as "sms" | "web") ?? "web" },
        { role: "model" as const, text: reply, channel: (channel as "sms" | "web") ?? "web" },
      ]);

      return NextResponse.json({
        engine: "gemini",
        channel: channel ?? "web",
        text: reply,
        patch: result.updates,
        revealMatches: result.revealMatches,
        tasks: result.tasks,
      });
    } catch (e) {
      console.error("[/api/chat] Gemini error, falling back to deterministic:", (e as Error).message);
    }
  }

  // Deterministic fallback
  const result = respond(base, message, turn ?? 0, revealed ?? false);
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
