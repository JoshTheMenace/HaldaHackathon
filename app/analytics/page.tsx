import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity, ArrowUpRight, BadgeCheck, BookOpen, Heart,
  LineChart, MapPin, MousePointer2, Sparkles, Target, Users,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { listStudents } from "@/lib/store";
import { SCHOOLS } from "@/lib/schools";
import { scoreSchool, titleCase } from "@/lib/match";
import type { School, StudentProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

type IntentLead = {
  student: StudentProfile;
  fit: number;
  intent: number;
  reasons: string[];
};

type SchoolAnalytics = {
  school: School;
  leads: IntentLead[];
  avgFit: number;
  saved: number;
  named: number;
  taskRate: number;
  topTags: string[];
};

const statusScore: Record<string, number> = { action: 22, draft: 18, review: 14, saved: 18 };

export default function AnalyticsPage() {
  const students = listStudents().filter((p) => p.consent?.shareWithPartners !== false);
  const rows = SCHOOLS.map((school) => analyticsForSchool(school, students))
    .filter((r) => r.leads.length > 0)
    .sort((a, b) => b.leads.length - a.leads.length || b.avgFit - a.avgFit)
    .slice(0, 10);
  const allLeads = rows.flatMap((r) => r.leads);
  const highIntent = allLeads.filter((l) => l.intent >= 70).length;
  const saved = new Set(students.flatMap((p) => p.savedSchoolIds ?? [])).size;
  const avgIntent = Math.round(allLeads.reduce((sum, l) => sum + l.intent, 0) / Math.max(1, allLeads.length));

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-pine">
      <header className="border-b border-line bg-white/92">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <span className="rounded-full bg-pine/8 px-2.5 py-1 text-[11px] font-700 text-pine">analytics</span>
          <Link href="/partner" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-700 text-pine shadow-soft">
            Partner console <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-xl2 border border-line bg-white p-5 shadow-soft">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-pine text-cream">
              <LineChart size={22} />
            </div>
            <h1 className="font-display text-3xl font-800 text-pine">High-intent school demand</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-sage">
              Live profile signals grouped by school: saved schools, named targets, match fit, engagement, and application readiness.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroStat icon={<Users size={18} />} label="profiles" value={students.length} />
            <HeroStat icon={<Target size={18} />} label="high intent" value={highIntent} />
            <HeroStat icon={<Heart size={18} />} label="schools saved" value={saved} />
            <HeroStat icon={<Activity size={18} />} label="avg intent" value={`${avgIntent}%`} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {rows.map((row) => (
            <SchoolCard key={row.school.id} row={row} />
          ))}
        </div>
      </section>
    </main>
  );
}

function analyticsForSchool(school: School, students: StudentProfile[]): SchoolAnalytics {
  const leads = students
    .map((student) => intentForSchool(student, school))
    .filter((lead) => lead.intent >= 58)
    .sort((a, b) => b.intent - a.intent)
    .slice(0, 4);
  const avgFit = Math.round(leads.reduce((sum, l) => sum + l.fit, 0) / Math.max(1, leads.length));
  const saved = leads.filter((l) => l.student.savedSchoolIds?.includes(school.id)).length;
  const named = leads.filter((l) => matchesTarget(l.student, school)).length;
  const taskRate = Math.round(leads.reduce((sum, l) => sum + readiness(l.student), 0) / Math.max(1, leads.length));
  const topTags = tagCounts(leads.flatMap((l) => profileTags(l.student)));
  return { school, leads, avgFit, saved, named, taskRate, topTags };
}

function intentForSchool(student: StudentProfile, school: School): IntentLead {
  const scored = scoreSchool(student, school);
  const tracked = student.trackedSchools?.find((s) => s.id === school.id);
  const reasons = [
    student.savedSchoolIds?.includes(school.id) ? "Saved school" : "",
    tracked ? `${titleCase(tracked.status)} tracker` : "",
    matchesTarget(student, school) ? "Named target" : "",
    scored.fit >= 75 ? "Strong fit" : "",
    student.tasks.some((t) => t.status === "done") ? "Tasks moving" : "",
  ].filter(Boolean);
  const explicit = (student.savedSchoolIds?.includes(school.id) ? 26 : 0) + (tracked ? statusScore[tracked.status] ?? 12 : 0) + (matchesTarget(student, school) ? 24 : 0);
  const intent = Math.min(100, Math.round(scored.fit * 0.58 + explicit + engagement(student) + readiness(student) * 0.08));
  return { student, fit: scored.fit, intent, reasons: reasons.length ? reasons : scored.reasons.slice(0, 2) };
}

function matchesTarget(student: StudentProfile, school: School) {
  const labels = [school.id, school.name, school.short].map(clean);
  return (student.targetSchools ?? []).some((target) => labels.some((label) => label.includes(clean(target)) || clean(target).includes(label)));
}

function engagement(p: StudentProfile) {
  return Math.min(14, Math.round((p.xp || 0) / 90) + Math.min(5, p.streak || 0) + (p.channelsLinked.length > 1 ? 2 : 0));
}

function readiness(p: StudentProfile) {
  const done = p.tasks.filter((t) => t.status === "done").length + (p.checklistDone ?? 0);
  const total = p.tasks.length + (p.checklistTotal ?? 0);
  if (!total) return p.transcriptStatus || p.lettersConfirmed ? 35 : 18;
  return Math.round((done / total) * 100);
}

function clean(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tagCounts(tags: string[]) {
  const counts = new Map<string, number>();
  tags.filter(Boolean).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag]) => tag);
}

function profileTags(p: StudentProfile) {
  const signals = p.interestSignals?.map((s) => titleCase(s.interest)) ?? [];
  return signals.length ? signals : [...p.intendedMajors, ...p.interests].map(titleCase);
}

function HeroStat({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between text-sage">{icon}<span className="text-[11px] font-700">{label}</span></div>
      <div className="mt-4 font-display text-3xl font-800 text-pine tnum">{value}</div>
    </div>
  );
}

function SchoolCard({ row }: { row: SchoolAnalytics }) {
  const hottest = row.leads[0];
  return (
    <article className="rounded-xl2 border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl font-display text-sm font-800 text-white" style={{ background: row.school.accent }}>
          {row.school.short.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-800">{row.school.short}</h2>
          <div className="flex items-center gap-1 text-xs text-sage"><MapPin size={12} /> {row.school.city}, {row.school.state}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-800 text-coral tnum">{row.leads.length}</div>
          <div className="text-[10px] font-700 text-sage">leads</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniStat label="avg fit" value={row.avgFit} />
        <MiniStat label="saved" value={row.saved} />
        <MiniStat label="named" value={row.named} />
        <MiniStat label="ready" value={`${row.taskRate}%`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.topTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#eef2f1] px-2 py-1 text-[11px] font-700 text-pine">
            <Sparkles size={11} className="text-coral" /> {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {row.leads.map((lead) => (
          <LeadRow key={lead.student.id} lead={lead} />
        ))}
      </div>

      {hottest && (
        <div className="mt-4 rounded-xl border border-coral/20 bg-coral/8 p-3 text-xs leading-5 text-coral-ink">
          <b>{initials(hottest.student)}</b> is the hottest signal here: {hottest.reasons[0]} with {hottest.intent}% intent.
        </div>
      )}
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-[#f8faf9] p-2 text-center">
      <div className="font-display text-lg font-800 tnum">{value}</div>
      <div className="text-[10px] font-700 text-sage">{label}</div>
    </div>
  );
}

function LeadRow({ lead }: { lead: IntentLead }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-[#fbfcfc] p-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-pine text-xs font-800 text-cream">{initials(lead.student)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-800">
          {lead.student.grade ? `Grade ${lead.student.grade}` : "Student"} · {initials(lead.student)}
          {lead.intent >= 85 && <BadgeCheck size={14} className="text-success" />}
        </div>
        <div className="truncate text-[11px] text-sage">{lead.reasons.join(" · ")}</div>
      </div>
      <div className="flex items-center gap-2 text-right">
        <Metric icon={<BookOpen size={12} />} value={lead.fit} />
        <Metric icon={<MousePointer2 size={12} />} value={lead.intent} hot />
      </div>
    </div>
  );
}

function Metric({ icon, value, hot }: { icon: ReactNode; value: number; hot?: boolean }) {
  return (
    <div className={hot ? "text-coral" : "text-pine"}>
      <div className="flex items-center justify-end gap-0.5 font-display text-sm font-800 tnum">{icon}{value}</div>
      <div className="text-[9px] font-700 text-sage">{hot ? "INTENT" : "FIT"}</div>
    </div>
  );
}

function initials(p: StudentProfile) {
  return (p.name || "Student").split(/\s+/).map((w) => w[0]?.toUpperCase()).slice(0, 2).join("");
}
