import { NextResponse } from "next/server";
import { linkPhone, studentForPhone, getStudent, upsertStudent, normalizePhone } from "@/lib/store";
import { sendSms, smsConfigured } from "@/lib/surge";
import type { StudentProfile } from "@/lib/types";

// Bind a phone number to the student's profile so texting picks up where the web
// chat left off, then send a welcome text. Body: { phone, profile }.
export async function POST(req: Request) {
  const { phone, profile } = (await req.json()) as { phone?: string; profile?: StudentProfile };
  const e164 = normalizePhone(phone || "");
  if (!e164 || e164.length < 11) {
    return NextResponse.json({ error: "Enter a valid phone number, e.g. (801) 555-1234." }, { status: 400 });
  }
  if (!profile?.id) {
    return NextResponse.json({ error: "No profile to link yet." }, { status: 400 });
  }

  // Make sure the latest web profile is in the store, then link the phone to it.
  if (!getStudent(profile.id)) upsertStudent(profile);
  linkPhone(e164, profile.id);

  if (!smsConfigured()) {
    return NextResponse.json({ linked: true, sent: false, note: "SMS not configured on the server." });
  }

  const s = getStudent(studentForPhone(e164) || profile.id);
  const name = s?.name ? `, ${s.name.split(" ")[0]}` : "";
  const sent = await sendSms(
    e164,
    `Hey${name}! It's Halda 👋 We're now linked — text me here anytime and we'll pick up right where we left off. What's on your mind?`
  );
  return NextResponse.json({ linked: true, sent: !!sent });
}
