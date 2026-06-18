import { NextResponse } from "next/server";
import { runAgent } from "@/lib/halda-agent";
import {
  studentForPhone, linkPhone, getStudent, upsertStudent,
  getHistory, appendHistory, normalizePhone,
} from "@/lib/store";
import { sendSms } from "@/lib/surge";
import type { StudentProfile } from "@/lib/types";

// A cold inbound texter with no linked web session still gets a working profile.
function blankSmsProfile(phone: string): StudentProfile {
  const id = `sms_${phone.replace(/\D/g, "")}`;
  return {
    id, interests: [], interestSignals: [], intendedMajors: [], tasks: [], creditWallet: [],
    savedSchoolIds: [], xp: 0, streak: 0, completedQuests: [], badges: [], channelsLinked: ["sms"],
    consent: { fields: ["name", "grade", "location", "interests", "major", "goal"], shareWithPartners: true },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

// Surge calls this when someone texts the Halda number. Same Gemini brain and
// same shared profile/transcript as the web chat — texting just continues it.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const type = body?.type;
  const message = body?.data;
  const from = message?.conversation?.contact?.phone_number;
  const text = message?.body?.trim();
  if (type !== "message.received" || !from || !text) return NextResponse.json({ ok: true });

  const phone = normalizePhone(from);
  // Resolve the linked web profile, or start a fresh SMS-only one.
  let studentId = studentForPhone(phone);
  if (!studentId) {
    const fresh = blankSmsProfile(phone);
    upsertStudent(fresh);
    linkPhone(phone, fresh.id);
    studentId = fresh.id;
  }
  const profile = getStudent(studentId) ?? blankSmsProfile(phone);
  const history = getHistory(studentId).map((t) => ({ role: t.role, text: t.text }));

  const apiKey = process.env.GEMINI_API_KEY;
  let reply = "Give me one sec — I'm having trouble thinking right now. Try me again in a moment!";
  try {
    if (!apiKey) throw new Error("no GEMINI_API_KEY");
    const result = await runAgent({ apiKey, profile, message: text, history });
    reply = result.reply || "Got it!";
    upsertStudent({ ...result.profile, id: studentId, channelsLinked: Array.from(new Set([...(result.profile.channelsLinked || []), "sms"])) });
    appendHistory(studentId, [
      { role: "user", text, channel: "sms" },
      { role: "model", text: reply, channel: "sms" },
    ]);
  } catch (e) {
    console.error("[sms/webhook] agent error:", (e as Error).message);
  }

  await sendSms(phone, reply);
  return NextResponse.json({ ok: true });
}
