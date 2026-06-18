import { NextResponse } from "next/server";
import type { StudentProfile, TaskItem, CreditItem } from "@/lib/types";

// ─── HTML email template ──────────────────────────────────────────────────────

function row(label: string, value: string | undefined | null, fallback = "Not provided") {
  const v = value?.trim() || fallback;
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${v}</td></tr>`;
}

function section(icon: string, title: string, content: string) {
  return `
    <div style="margin:0 0 24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:18px;">${icon}</span>
        <h2 style="margin:0;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;">${title}</h2>
      </div>
      ${content}
    </div>`;
}

function pill(text: string, color = "#e5e7eb", textColor = "#374151") {
  return `<span style="display:inline-block;background:${color};color:${textColor};font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;margin:2px 3px 2px 0;">${text}</span>`;
}

function buildHtml(p: StudentProfile): string {
  const name = p.name || "Your student";
  const first = name.split(" ")[0];
  const GRADE: Record<number, string> = { 9: "Freshman (9th)", 10: "Sophomore (10th)", 11: "Junior (11th)", 12: "Senior (12th)" };
  const STATUS_LABEL: Record<string, string> = { review: "Under Review", draft: "Draft", action: "Action Needed", saved: "Saved" };
  const STATUS_COLOR: Record<string, string> = { review: "#fef3c7", draft: "#e0f2fe", action: "#fee2e2", saved: "#dcfce7" };
  const STATUS_TEXT: Record<string, string> = { review: "#92400e", draft: "#0369a1", action: "#991b1b", saved: "#166534" };
  const fmt = (d: string | number) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const sch = p.scholarships ?? { applied: 0, won: 0, rejected: 0, pending: 0 };
  const tasks = [...(p.tasks ?? [])].sort((a: TaskItem, b: TaskItem) =>
    (a.due ? new Date(a.due).getTime() : Infinity) - (b.due ? new Date(b.due).getTime() : Infinity)
  );
  const pending = tasks.filter((t: TaskItem) => t.status !== "done");
  const done = tasks.filter((t: TaskItem) => t.status === "done");
  const tracked = p.trackedSchools ?? [];
  const credits = p.creditWallet ?? [];
  const extras = p.extracurriculars?.length ? p.extracurriculars : (p.interestSignals ?? []).map((s) => s.interest);

  // Profile section
  const profileContent = `
    <table style="border-collapse:collapse;width:100%;">
      ${row("Name", p.name)}
      ${row("Grade", p.grade ? (GRADE[p.grade] ?? `Grade ${p.grade}`) : null)}
      ${row("High School", p.highSchool)}
      ${row("Location", [p.city, p.state, p.zip].filter(Boolean).join(", ") || null)}
      ${row("Email", p.email)}
      ${row("Phone", p.phone)}
    </table>`;

  // Academics section
  const academicContent = `
    <table style="border-collapse:collapse;width:100%;">
      ${row("GPA", p.gpa)}
      ${row(p.testType || "Test Score", p.testScore)}
      ${row("Transcript", p.transcriptStatus)}
      ${row("Letters of Rec", p.lettersTotal ? `${p.lettersConfirmed ?? 0} of ${p.lettersTotal} confirmed` : null)}
      ${row("Service Hours", p.serviceHours != null ? `${p.serviceHours} hrs${p.serviceFocus ? ` — ${p.serviceFocus}` : ""}` : null)}
      ${row("Checklist", p.checklistTotal ? `${p.checklistDone ?? 0} of ${p.checklistTotal} complete` : "Not started")}
    </table>`;

  // Preferences section
  const prefContent = `
    <table style="border-collapse:collapse;width:100%;">
      ${row("Intended Major(s)", p.intendedMajors?.join(", ") || null)}
      ${row("Career Goal", p.careerGoal)}
      ${row("Campus Setting", p.settingPref)}
      ${row("Campus Size", p.sizePref)}
      ${row("Stay In-State", p.stayInState === true ? "Yes" : p.stayInState === false ? "No" : null)}
      ${row("Max Budget/yr", p.maxBudget ? `$${p.maxBudget.toLocaleString()}` : null)}
      ${row("Needs Financial Aid", p.needsAid === true ? "Yes" : p.needsAid === false ? "No" : null)}
      ${row("First-Generation", p.firstGen === true ? "Yes" : p.firstGen === false ? "No" : null)}
    </table>
    ${p.interests?.length ? `<div style="margin-top:10px;">${p.interests.map((i) => pill(i, "#ede9fe", "#6d28d9")).join("")}</div>` : ""}`;

  // Extracurriculars
  const extrasContent = extras.length
    ? `<div>${extras.map((e) => pill(e)).join("")}</div>`
    : `<p style="margin:0;color:#9ca3af;font-size:13px;">None recorded yet</p>`;

  // Deadlines
  const deadlineContent = pending.length
    ? pending.map((t: TaskItem) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#f9fafb;border-radius:8px;margin-bottom:6px;">
          <div style="width:8px;height:8px;background:#f59e0b;border-radius:50%;margin-top:5px;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:#111827;">${t.title}</div>
            ${t.detail ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${t.detail}</div>` : ""}
          </div>
          ${t.due ? `<div style="font-size:12px;color:#6b7280;white-space:nowrap;">${fmt(t.due)}</div>` : ""}
        </div>`).join("")
      + (done.length ? `<div style="margin-top:10px;font-size:12px;color:#9ca3af;">${done.length} task${done.length !== 1 ? "s" : ""} completed ✓</div>` : "")
    : `<p style="margin:0;color:#9ca3af;font-size:13px;">No upcoming deadlines on record</p>`;

  // Scholarships
  const schContent = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
      ${[["Applied", sch.applied, "#dbeafe", "#1e40af"], ["Won", sch.won, "#dcfce7", "#166534"], ["Rejected", sch.rejected, "#fee2e2", "#991b1b"], ["Pending", sch.pending, "#fef3c7", "#92400e"]].map(([label, val, bg, color]) =>
        `<div style="background:${bg};border-radius:8px;padding:12px 6px;">
          <div style="font-size:22px;font-weight:700;color:${color};">${val}</div>
          <div style="font-size:11px;color:${color};font-weight:600;">${label}</div>
        </div>`).join("")}
    </div>`;

  // Schools
  const schoolsContent = tracked.length
    ? tracked.map((s: { label?: string; id: string; status: string }) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f9fafb;border-radius:8px;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:600;color:#111827;">${s.label || s.id}</span>
          <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:${STATUS_COLOR[s.status] || "#e5e7eb"};color:${STATUS_TEXT[s.status] || "#374151"};">${STATUS_LABEL[s.status] ?? s.status}</span>
        </div>`).join("")
    : `<p style="margin:0;color:#9ca3af;font-size:13px;">No schools being tracked yet</p>`;

  // Credits
  const creditsContent = credits.length
    ? credits.map((c: CreditItem) =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f9fafb;border-radius:8px;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:999px;">${c.type.toUpperCase()}</span>
          <span style="font-size:13px;color:#111827;flex:1;">${c.source}</span>
          ${c.score ? `<span style="font-size:12px;color:#6b7280;">Score: ${c.score}</span>` : ""}
        </div>`).join("")
    : `<p style="margin:0;color:#9ca3af;font-size:13px;">No AP/dual-enrollment credits recorded yet</p>`;

  // Achievements
  const achieveContent = `
    <table style="border-collapse:collapse;width:100%;">
      ${row("XP Earned", String(p.xp ?? 0))}
      ${row("Streak", `${p.streak ?? 0} day${(p.streak ?? 0) !== 1 ? "s" : ""}`)}
      ${row("Badges", p.badges?.length ? p.badges.join(", ") : null)}
      ${row("Channels Linked", p.channelsLinked?.join(", ") || "Web")}
    </table>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#006b5f,#00a896);padding:32px 32px 28px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-.5px;">Halda AI</div>
      <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px;">College Progress Report</div>
      <div style="margin-top:20px;background:rgba(255,255,255,.15);border-radius:12px;padding:16px 24px;display:inline-block;">
        <div style="font-size:24px;font-weight:700;color:#fff;">${name}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px;">Report generated ${fmt(Date.now())}</div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      ${section("👤", "Student Profile", profileContent)}
      ${section("📚", "Academic Standing", academicContent)}
      ${section("🎯", "College Fit Preferences", prefContent)}
      ${section("⭐", "Extracurriculars & Activities", extrasContent)}
      ${section("📅", "Upcoming Deadlines & Calendar", deadlineContent)}
      ${section("💰", "Scholarships", schContent)}
      ${section("🏫", "Tracked Schools", schoolsContent)}
      ${section("🎓", "College Credit Wallet", creditsContent)}
      ${section("🏅", "Achievements & Engagement", achieveContent)}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
      <div style="font-size:13px;color:#6b7280;">This report was sent by <strong>Halda AI</strong> — ${first}'s personal college guide.</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:6px;">© ${new Date().getFullYear()} Halda AI · Made for the class of ${(p.grade ?? 11) + (12 - (p.grade ?? 11)) + new Date().getFullYear() - new Date().getFullYear() + 2028}</div>
    </div>
  </div>
</body>
</html>`;
}

const GRADE: Record<number, string> = { 9: "Freshman (9th)", 10: "Sophomore (10th)", 11: "Junior (11th)", 12: "Senior (12th)" };
const STATUS_LABEL: Record<string, string> = { review: "Under Review", draft: "Draft", action: "Action Needed", saved: "Saved" };
const fmt = (d: string | number) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const val = (v: string | number | boolean | undefined | null, fallback = "Not provided") =>
  v == null || v === "" ? fallback : String(v);

function buildSummary(p: StudentProfile): string {
  const name = p.name || "Your student";
  const first = name.split(" ")[0];
  const sch = p.scholarships ?? { applied: 0, won: 0, rejected: 0, pending: 0 };
  const tasks = p.tasks ?? [];
  const allTasks = [...tasks].sort((a: TaskItem, b: TaskItem) =>
    (a.due ? new Date(a.due).getTime() : Infinity) - (b.due ? new Date(b.due).getTime() : Infinity)
  );
  const pending = allTasks.filter((t: TaskItem) => t.status !== "done");
  const done = allTasks.filter((t: TaskItem) => t.status === "done");
  const tracked = p.trackedSchools ?? [];
  const credits = p.creditWallet ?? [];

  const lines: string[] = [];
  const push = (...s: string[]) => lines.push(...s);
  const section = (title: string) => { push("", `── ${title} ──`, ""); };

  push(`📊 HALDA AI — COLLEGE PROGRESS REPORT`);
  push(`Student: ${name}`);
  push(`Generated: ${fmt(Date.now())}`);

  // ── Student Profile ──
  section("👤 STUDENT PROFILE");
  push(`Name:         ${val(p.name)}`);
  push(`Grade:        ${p.grade ? GRADE[p.grade] ?? `Grade ${p.grade}` : "Not provided"}`);
  push(`High School:  ${val(p.highSchool)}`);
  push(`Location:     ${[p.city, p.state, p.zip].filter(Boolean).join(", ") || "Not provided"}`);
  push(`Email:        ${val(p.email)}`);
  push(`Phone:        ${val(p.phone)}`);

  // ── Academic Standing ──
  section("📚 ACADEMIC STANDING");
  push(`GPA:               ${val(p.gpa)}`);
  push(`${p.testType || "Test"} Score:       ${val(p.testScore)}`);
  push(`Transcript Status: ${val(p.transcriptStatus)}`);
  push(`Letters of Rec:    ${p.lettersTotal ? `${p.lettersConfirmed ?? 0} of ${p.lettersTotal} confirmed` : "Not provided"}`);
  push(`Service Hours:     ${p.serviceHours != null ? `${p.serviceHours} hrs` : "Not provided"}${p.serviceFocus ? ` — ${p.serviceFocus}` : ""}`);
  push(`Checklist:         ${p.checklistTotal ? `${p.checklistDone ?? 0} of ${p.checklistTotal} complete` : "Not started"}`);

  // ── College Fit Preferences ──
  section("🎯 COLLEGE FIT PREFERENCES");
  push(`Intended Major(s):  ${p.intendedMajors?.length ? p.intendedMajors.join(", ") : "Not provided"}`);
  push(`Career Goal:        ${val(p.careerGoal)}`);
  push(`Interests:          ${p.interests?.length ? p.interests.join(", ") : "Not provided"}`);
  push(`Campus Setting:     ${val(p.settingPref)}`);
  push(`Campus Size:        ${val(p.sizePref)}`);
  push(`Stay In-State:      ${p.stayInState === true ? "Yes" : p.stayInState === false ? "No" : "Not provided"}`);
  push(`Max Budget/yr:      ${p.maxBudget ? `$${p.maxBudget.toLocaleString()}` : "Not provided"}`);
  push(`Needs Financial Aid: ${p.needsAid === true ? "Yes" : p.needsAid === false ? "No" : "Not provided"}`);
  push(`First-Generation:   ${p.firstGen === true ? "Yes" : p.firstGen === false ? "No" : "Not provided"}`);

  // ── Extracurriculars ──
  section("⭐ EXTRACURRICULARS & ACTIVITIES");
  const extras = p.extracurriculars?.length ? p.extracurriculars : p.interestSignals?.map((s) => s.interest);
  if (extras?.length) {
    extras.forEach((e) => push(`• ${e}`));
  } else {
    push("None recorded yet");
  }

  // ── Upcoming Deadlines / Calendar ──
  section("📅 UPCOMING DEADLINES & CALENDAR");
  if (pending.length) {
    pending.forEach((t: TaskItem) => {
      const due = t.due ? fmt(t.due) : "No date";
      push(`• [${t.status.toUpperCase()}] ${t.title} — ${due}`);
      if (t.detail) push(`  ${t.detail}`);
    });
  } else {
    push("No upcoming deadlines on record");
  }
  if (done.length) {
    push("", `Completed (${done.length}):`);
    done.forEach((t: TaskItem) => push(`✓ ${t.title}`));
  }

  // ── Scholarships ──
  section("💰 SCHOLARSHIPS");
  push(`Applied:  ${sch.applied}`);
  push(`Won:      ${sch.won}`);
  push(`Rejected: ${sch.rejected}`);
  push(`Pending:  ${sch.pending}`);

  // ── Tracked Schools ──
  section("🏫 TRACKED SCHOOLS");
  if (tracked.length) {
    tracked.forEach((s: { label?: string; id: string; status: string }) => {
      push(`• ${s.label || s.id} — ${STATUS_LABEL[s.status] ?? s.status}`);
    });
  } else {
    push("No schools being tracked yet");
  }

  // ── Credit Wallet ──
  section("🎓 COLLEGE CREDIT WALLET");
  if (credits.length) {
    credits.forEach((c) => {
      push(`• ${c.source} — ${c.type.toUpperCase()} ${c.subject}${c.score ? ` (Score: ${c.score})` : ""}`);
    });
  } else {
    push("No AP/dual-enrollment credits recorded yet");
  }

  // ── Badges & Progress ──
  section("🏅 ACHIEVEMENTS & ENGAGEMENT");
  push(`XP Earned:  ${p.xp}`);
  push(`Streak:     ${p.streak} day${p.streak !== 1 ? "s" : ""}`);
  push(`Badges:     ${p.badges?.length ? p.badges.join(", ") : "None yet"}`);
  push(`Channels:   ${p.channelsLinked?.join(", ") || "Web"}`);

  push("", "─────────────────────────────────────────");
  push(`Sent by Halda AI — ${first}'s personal college guide.`);
  push(`Report generated ${fmt(Date.now())}`);

  return lines.join("\n");
}

export async function POST(req: Request) {
  const { channel, contact, profile } = (await req.json()) as {
    channel: "sms" | "email";
    contact: string;
    profile: StudentProfile;
  };

  if (!contact || !profile) {
    return NextResponse.json({ error: "contact and profile required" }, { status: 400 });
  }

  const summary = buildSummary(profile);
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
  const name = profile.name || "Your student";

  try {
    if (channel === "sms") {
      const r = await fetch(`${backendUrl}/api/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: contact, body: summary }),
      });
      const d = await r.json();
      if (!r.ok) return NextResponse.json({ error: d.error || "SMS failed" }, { status: 502 });
      return NextResponse.json({ sent: true });
    } else {
      const html = buildHtml(profile);
      const r = await fetch(`${backendUrl}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: contact,
          subject: `College Progress Report — ${name}`,
          body: summary,
          html,
        }),
      });
      const d = await r.json();
      if (!r.ok) return NextResponse.json({ error: d.error || "Email failed" }, { status: 502 });
      return NextResponse.json({ sent: true });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
