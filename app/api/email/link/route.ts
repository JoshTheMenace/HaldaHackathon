import { NextResponse } from "next/server";
import { getStudent, upsertStudent } from "@/lib/store";
import type { StudentProfile } from "@/lib/types";

// Link an email address to the student's profile so emailing picks up where
// the web chat left off, then send a welcome email via the Express backend.
export async function POST(req: Request) {
  const { email, profile } = (await req.json()) as { email?: string; profile?: StudentProfile };

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!profile?.id) {
    return NextResponse.json({ error: "No profile to link yet." }, { status: 400 });
  }

  // Upsert the profile with the email so emailToStudent gets populated.
  const updated: StudentProfile = { ...profile, email: normalizedEmail, updatedAt: Date.now() };
  if (!getStudent(profile.id)) upsertStudent(profile);
  upsertStudent(updated);

  // Send a welcome email via the Express backend.
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
  try {
    const r = await fetch(`${backendUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: normalizedEmail,
        subject: "Halda is in your inbox",
        body: `Hey${profile.name ? `, ${profile.name.split(" ")[0]}` : ""}! 👋 Halda here — we're now linked via email. Reply to this message anytime and we'll pick up right where we left off. What's on your mind?`,
      }),
    });
    const d = await r.json();
    if (!r.ok) return NextResponse.json({ linked: true, sent: false, note: d.error });
    return NextResponse.json({ linked: true, sent: true });
  } catch {
    return NextResponse.json({ linked: true, sent: false, note: "Email couldn't send — check server setup." });
  }
}
