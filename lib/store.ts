import type { Lead, School, StudentProfile } from "./types";
import { SCHOOLS, schoolById } from "./schools";
import { scoreSchool, titleCase } from "./match";
import { SCHOOL_COORDS, haversineMi, resolveZip } from "./geo";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory multi-tenant store. Two tenant types:
//   • STUDENTS live in a tenant-agnostic namespace and own their own data.
//   • TENANTS (universities) never hold student rows — they can only ever touch
//     Leads, and only through withTenant(), which injects tenantId into every
//     access and THROWS if it's missing. Cross-tenant leakage is structurally
//     impossible, not a matter of convention. Schools buy a frozen snapshot.
// In-memory by design: nothing to set up, nothing to break on the venue wifi.
// ─────────────────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string; // === a partner school id
  name: string;
  slug: string;
  schoolId: string;
  brand: string;
  leadCredits: number;
  region: string;
}

// One conversation turn, shared across channels so web and SMS see one thread.
export interface ConvoTurn {
  role: "user" | "model";
  text: string;
  channel?: "web" | "sms" | "voice";
  ts?: number;
}

interface StoreShape {
  students: Map<string, StudentProfile>;
  tenants: Tenant[];
  // tenantId -> (leadId -> Lead). The ONLY place school-visible data lives.
  leadsByTenant: Map<string, Map<string, Lead>>;
  // Cross-channel handoff: phone/email map to ONE studentId so any channel
  // picks up exactly where the last one left off.
  phoneToStudent: Map<string, string>;
  emailToStudent: Map<string, string>;
  historyByStudent: Map<string, ConvoTurn[]>;
}

const g = globalThis as unknown as { __halda?: StoreShape };

function blankProfile(id: string, name: string): StudentProfile {
  return {
    id,
    name,
    interests: [],
    interestSignals: [],
    intendedMajors: [],
    tasks: [],
    creditWallet: [],
    xp: 0,
    streak: 0,
    completedQuests: [],
    badges: [],
    channelsLinked: ["web"],
    consent: {
      fields: ["name", "grade", "location", "interests", "major", "goal"],
      shareWithPartners: true,
    },
    createdAt: 0,
    updatedAt: 0,
  };
}

// A believable cohort so each tenant has a real (and DIFFERENT) lead list.
function seedStudents(): Map<string, StudentProfile> {
  const m = new Map<string, StudentProfile>();
  const add = (p: StudentProfile) => m.set(p.id, p);

  add({
    ...blankProfile("stu_maya", "Maya Rodriguez"),
    zip: "78701", city: "Austin", state: "TX", highSchool: "Austin High School",
    grade: 10, interests: ["Coding", "AI", "Art"], intendedMajors: ["Computer Science"],
    interestSignals: [
      { interest: "coding", intent: "career_path", importance: "must_have", evidenceQuote: "I build little apps for fun" },
      { interest: "AI", intent: "major", importance: "high" },
      { interest: "art", intent: "personal_hobby", importance: "low" },
    ],
    careerGoal: "Build apps that help people", settingPref: "city", sizePref: "large",
    needsAid: true, maxBudget: 20000, firstGen: true,
    xp: 305, streak: 4, completedQuests: ["q_meet", "q_map", "q_spark", "q_direction", "q_campus", "q_money", "q_constellation"],
    badges: ["b_first_steps", "b_star_mapper", "b_early_bird"], channelsLinked: ["web", "sms"],
    createdAt: 1, updatedAt: 1,
  });
  add({
    ...blankProfile("stu_devon", "Devon Carter"),
    zip: "77002", city: "Houston", state: "TX", highSchool: "Bellaire HS",
    grade: 11, interests: ["Robotics", "Engineering"], intendedMajors: ["Engineering"],
    interestSignals: [
      { interest: "robotics", intent: "serious_extracurricular", importance: "high", evidenceQuote: "I do competition robotics" },
      { interest: "engineering", intent: "career_path", importance: "must_have" },
    ],
    careerGoal: "Aerospace engineer", settingPref: "suburban", sizePref: "large",
    maxBudget: 25000, xp: 540, streak: 9,
    completedQuests: ["q_meet", "q_map", "q_spark", "q_direction", "q_campus", "q_money", "q_constellation", "q_list"],
    badges: ["b_first_steps", "b_star_mapper", "b_planner", "b_on_a_roll"], channelsLinked: ["web", "sms", "email"],
    createdAt: 1, updatedAt: 1,
  });
  add({
    ...blankProfile("stu_aisha", "Aisha Bello"),
    zip: "30303", city: "Atlanta", state: "GA", highSchool: "Grady HS",
    grade: 10, interests: ["Health & Bio", "Coding"], intendedMajors: ["Biology"],
    interestSignals: [
      { interest: "medicine", intent: "career_path", importance: "must_have", evidenceQuote: "I want to be a doctor" },
      { interest: "biology", intent: "major", importance: "high" },
    ],
    careerGoal: "Doctor", settingPref: "city", sizePref: "small", needsAid: true,
    xp: 270, streak: 3, completedQuests: ["q_meet", "q_map", "q_spark", "q_direction", "q_constellation"],
    badges: ["b_first_steps", "b_star_mapper"], channelsLinked: ["web", "email"],
    createdAt: 1, updatedAt: 1,
  });
  add({
    ...blankProfile("stu_liam", "Liam O'Connor"),
    zip: "98101", city: "Seattle", state: "WA", highSchool: "Garfield HS",
    grade: 11, interests: ["Coding", "Game Design"], intendedMajors: ["Computer Science"],
    careerGoal: "Game developer", settingPref: "city", sizePref: "large", maxBudget: 30000,
    xp: 420, streak: 6, completedQuests: ["q_meet", "q_map", "q_spark", "q_direction", "q_campus", "q_constellation"],
    badges: ["b_first_steps", "b_star_mapper", "b_on_a_roll"], channelsLinked: ["web", "sms"],
    createdAt: 1, updatedAt: 1,
  });
  add({
    ...blankProfile("stu_sofia", "Sofia Marín"),
    zip: "85281", city: "Tempe", state: "AZ", highSchool: "Tempe HS",
    grade: 10, interests: ["Business", "Design"], intendedMajors: ["Business"],
    careerGoal: "Start a company", settingPref: "city", sizePref: "large", needsAid: true,
    xp: 190, streak: 2, completedQuests: ["q_meet", "q_map", "q_spark", "q_direction"],
    badges: ["b_first_steps"], channelsLinked: ["web"],
    createdAt: 1, updatedAt: 1,
  });
  add({
    ...blankProfile("stu_noah", "Noah Kim"),
    zip: "80302", city: "Boulder", state: "CO", highSchool: "Boulder HS",
    grade: 11, interests: ["Space", "Engineering"], intendedMajors: ["Aerospace"],
    careerGoal: "Work at NASA", settingPref: "suburban", sizePref: "large", maxBudget: 28000,
    xp: 610, streak: 11, completedQuests: ["q_meet", "q_map", "q_spark", "q_direction", "q_campus", "q_money", "q_constellation", "q_list", "q_essay"],
    badges: ["b_first_steps", "b_star_mapper", "b_planner", "b_on_a_roll", "b_wordsmith"], channelsLinked: ["web", "sms", "email"],
    createdAt: 1, updatedAt: 1,
  });
  add({
    ...blankProfile("stu_emma", "Emma Thompson"),
    zip: "02115", city: "Boston", state: "MA", highSchool: "Boston Latin",
    grade: 10, interests: ["Writing", "Business"], intendedMajors: ["Journalism"],
    careerGoal: "Journalist", settingPref: "city", sizePref: "medium", maxBudget: 35000,
    xp: 230, streak: 3, completedQuests: ["q_meet", "q_map", "q_spark", "q_direction", "q_constellation"],
    badges: ["b_first_steps", "b_star_mapper"], channelsLinked: ["web", "email"],
    createdAt: 1, updatedAt: 1,
  });
  return m;
}

function seedTenants(): Tenant[] {
  const mk = (schoolId: string, credits: number): Tenant => {
    const s = schoolById(schoolId)!;
    return {
      id: schoolId,
      name: `${s.name} — Admissions`,
      slug: schoolId,
      schoolId,
      brand: s.accent,
      leadCredits: credits,
      region: s.region,
    };
  };
  // Three partner tenants spanning region + selectivity, so lead lists differ.
  return [mk("ut-austin", 1200), mk("asu", 2000), mk("northeastern", 900)];
}

function engagement(p: StudentProfile): string {
  const flame = p.streak >= 7 ? "🔥" : "";
  return `Active · ${p.streak}-day streak ${flame}· ${p.xp} XP`.trim();
}

function maskedRegion(p: StudentProfile): string {
  if (p.city && p.state) return `${p.city}, ${p.state} area`;
  if (p.state) return `${p.state}`;
  return "Region withheld";
}

function buildLead(tenant: Tenant, p: StudentProfile): Lead | null {
  const school = schoolById(tenant.schoolId)!;
  const m = scoreSchool(p, school);
  // Only surface genuine fits — but the live demo student is always present.
  if (m.fit < 55 && p.id !== "stu_maya") return null;
  const here = resolveZip(p.zip, p.state);
  const there = SCHOOL_COORDS[school.id];
  const distanceMi = here && there ? haversineMi(here, there) : 0;
  const initials = (p.name || "??")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  const gradeLabel =
    { 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" }[
      p.grade || 0
    ] || "Student";

  // Intent-signaled interests are the real product — a school sees not just
  // "interested in film" but "film, as a career".
  const intentLabel: Record<string, string> = {
    career_path: "career", major: "major", serious_extracurricular: "serious",
    community: "community", fan_culture: "fan", personal_hobby: "hobby",
  };
  const interestIntents = (p.interestSignals ?? [])
    .slice(0, 3)
    .map((s) => `${titleCase(s.interest)} · ${intentLabel[s.intent] ?? s.intent}`);
  const intent = [
    ...interestIntents,
    ...p.intendedMajors.slice(0, 1),
    ...(p.needsAid ? ["Aid-sensitive"] : []),
  ].slice(0, 4);

  return {
    id: `lead_${tenant.id}_${p.id}`,
    schoolId: tenant.id,
    studentId: p.id,
    fit: m.fit,
    reach: m.reach,
    status: "matched",
    masked: {
      initials,
      gradeLabel,
      region: maskedRegion(p),
      distanceMi,
      intent,
      engagement: engagement(p),
      fitBlurb: m.reasons[0] || school.vibe,
    },
  };
}

function rebuildLeads(store: StoreShape) {
  store.leadsByTenant = new Map();
  for (const t of store.tenants) {
    const map = new Map<string, Lead>();
    for (const p of store.students.values()) {
      if (!p.consent?.shareWithPartners) continue;
      const lead = buildLead(t, p);
      if (lead) map.set(lead.id, lead);
    }
    store.leadsByTenant.set(t.id, map);
  }
}

function init(): StoreShape {
  const store: StoreShape = {
    students: seedStudents(),
    tenants: seedTenants(),
    leadsByTenant: new Map(),
    phoneToStudent: new Map(),
    emailToStudent: new Map(),
    historyByStudent: new Map(),
  };
  rebuildLeads(store);
  return store;
}

function store(): StoreShape {
  if (!g.__halda) g.__halda = init();
  return g.__halda;
}

// ── Public, tenant-AGNOSTIC operations (students own their data) ─────────────

export function getTenants(): Tenant[] {
  return store().tenants.map((t) => ({ ...t }));
}

export function getStudent(id: string): StudentProfile | undefined {
  return store().students.get(id);
}

export function listStudents(): StudentProfile[] {
  return [...store().students.values()].map((p) => ({ ...p }));
}

export function upsertStudent(p: StudentProfile) {
  const s = store();
  s.students.set(p.id, { ...p, updatedAt: Date.now() });
  // Keep cross-channel lookup maps in sync automatically
  if (p.phone) s.phoneToStudent.set(normalizePhone(p.phone), p.id);
  if (p.email) s.emailToStudent.set(p.email.toLowerCase(), p.id);
  rebuildLeads(s); // learning more => better matches, live
}

export function resetStore() {
  g.__halda = init();
}

// ── Cross-channel handoff (web ↔ SMS share one profile + one transcript) ──────

// Normalize any typed number to E.164 (assume US +1 for 10-digit inputs).
export function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (raw.trim().startsWith("+")) return "+" + d;
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return "+" + d;
}

// Link a phone to a student so an inbound text resolves to the right profile.
export function linkPhone(phone: string, studentId: string) {
  const e164 = normalizePhone(phone);
  if (!e164 || !studentId) return;
  store().phoneToStudent.set(e164, studentId);
  const s = getStudent(studentId);
  if (s && !s.channelsLinked.includes("sms")) {
    upsertStudent({ ...s, channelsLinked: [...s.channelsLinked, "sms"] });
  }
}

export function studentForPhone(phone: string): string | undefined {
  return store().phoneToStudent.get(normalizePhone(phone));
}

export function studentForEmail(email: string): string | undefined {
  return store().emailToStudent.get(email.toLowerCase());
}

export function getHistory(studentId: string): ConvoTurn[] {
  return store().historyByStudent.get(studentId) ?? [];
}

// Append turns to the shared transcript (most recent kept; capped for safety).
export function appendHistory(studentId: string, turns: ConvoTurn[]) {
  if (!studentId || !turns.length) return;
  const h = store().historyByStudent.get(studentId) ?? [];
  h.push(...turns.map((t) => ({ ...t, ts: t.ts ?? Date.now() })));
  store().historyByStudent.set(studentId, h.slice(-40));
}

// ── Tenant-SCOPED access. The ONLY door to school-visible data. ──────────────

export class TenantScope {
  constructor(private tenant: Tenant) {}

  get info(): Tenant {
    return { ...this.tenant };
  }

  listLeads(): Lead[] {
    const map = store().leadsByTenant.get(this.tenant.id);
    if (!map) return [];
    return [...map.values()].sort((a, b) => b.fit - a.fit);
  }

  getLead(leadId: string): Lead | undefined {
    return store().leadsByTenant.get(this.tenant.id)?.get(leadId);
  }

  purchase(leadId: string): Lead {
    const t = store().tenants.find((x) => x.id === this.tenant.id)!;
    const lead = store().leadsByTenant.get(this.tenant.id)?.get(leadId);
    if (!lead) throw new Error("Lead not found in this tenant");
    if (lead.status === "purchased") return lead;
    const school = schoolById(t.schoolId)!;
    if (t.leadCredits < school.cpl) throw new Error("Insufficient lead credits");

    const p = store().students.get(lead.studentId)!;
    // Freeze a redacted snapshot — schools buy a profile, NOT live access.
    const consented = new Set(p.consent?.fields ?? []);
    lead.revealed = {
      name: consented.has("name") ? p.name || "—" : "—",
      highSchool: consented.has("location") ? p.highSchool : undefined,
      grade: consented.has("grade") ? p.grade : undefined,
      intendedMajors: consented.has("major") ? p.intendedMajors : [],
      interests: consented.has("interests") ? p.interests : [],
      careerGoal: consented.has("goal") ? p.careerGoal : undefined,
      contact: {
        channel: "email",
        handle: handleFor(p),
      },
    };
    lead.status = "purchased";
    lead.purchasedAt = Date.now();
    t.leadCredits -= school.cpl;
    return lead;
  }
}

export function withTenant(tenantId: string | undefined | null): TenantScope {
  if (!tenantId) throw new Error("withTenant: tenantId is required (isolation)");
  const t = store().tenants.find((x) => x.id === tenantId || x.slug === tenantId);
  if (!t) throw new Error(`withTenant: unknown tenant '${tenantId}'`);
  return new TenantScope(t);
}

function handleFor(p: StudentProfile): string {
  const base = (p.name || "student").toLowerCase().replace(/[^a-z]/g, ".");
  return `${base}@halda.dm`;
}

export { titleCase };
