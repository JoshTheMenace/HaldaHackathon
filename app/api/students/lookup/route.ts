import { NextResponse } from "next/server";
import { studentForPhone, studentForEmail, getStudent } from "@/lib/store";

// GET /api/students/lookup?phone=+18015551234
// GET /api/students/lookup?email=user@example.com
// Used by the SMS/email backend to find the right profile for cross-channel handoff.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const email = searchParams.get("email");

  if (phone) {
    const studentId = studentForPhone(phone);
    if (!studentId) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ studentId, profile: getStudent(studentId) });
  }

  if (email) {
    const studentId = studentForEmail(email);
    if (!studentId) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ studentId, profile: getStudent(studentId) });
  }

  return NextResponse.json({ error: "phone or email required" }, { status: 400 });
}
