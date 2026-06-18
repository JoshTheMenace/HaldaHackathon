"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useHalda } from "@/lib/useHalda";
import { translateHaldaProfile } from "@/lib/evaluator";
import "./simulator.css";

type View = "select" | "loading" | "report";
type LoadState = "running" | "done" | "error";

interface CollegeMeta { slug: string; name: string; }

// ── Rendering helpers (ported from Flask template JS) ──────────────────────

function tierColors(score: number) {
  if (score >= 80) return { bg: "#1B6B51", text: "#fff", border: "#1B6B51", lightBg: "rgba(27,107,81,0.05)", bar: "#1B6B51" };
  if (score >= 65) return { bg: "#006B5F", text: "#fff", border: "#006B5F", lightBg: "rgba(0,107,95,0.05)", bar: "#006B5F" };
  if (score >= 50) return { bg: "#16B89E", text: "#064A40", border: "#0E9B86", lightBg: "rgba(22,184,158,0.05)", bar: "#16B89E" };
  if (score >= 35) return { bg: "#687A76", text: "#fff", border: "#687A76", lightBg: "rgba(104,122,118,0.05)", bar: "#687A76" };
  if (score >= 20) return { bg: "#FFDAD6", text: "#BA1A1A", border: "#BA1A1A", lightBg: "rgba(186,26,26,0.04)", bar: "#D97706" };
  return { bg: "#BA1A1A", text: "#fff", border: "#BA1A1A", lightBg: "rgba(186,26,26,0.05)", bar: "#BA1A1A" };
}

function barColor(n: number) {
  if (n >= 75) return "var(--sim-success)";
  if (n >= 55) return "var(--sim-accent)";
  if (n >= 35) return "#D97706";
  return "var(--sim-error)";
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function collegeShortName(college: Record<string, unknown>): string {
  const map: Record<string, string> = {
    asu: "ASU", byu: "BYU", caltech: "Caltech", gatech: "Georgia Tech",
    mit: "MIT", nyu: "NYU", osu: "Ohio State", sjsu: "SJSU", unc: "UNC",
    utep: "UTEP", uvu: "UVU", uw: "UW", boisestate: "Boise State", miamidade: "Miami Dade",
  };
  return map[college.slug as string] || cap(college.slug as string) || (college.name as string).split(" ")[0];
}

const FACTOR_LABELS: Record<string, string> = {
  rigor_of_coursework: "Course Rigor", gpa: "GPA", class_rank: "Class Rank",
  test_scores: "Test Scores", standardized_tests: "Test Scores",
  application_essay: "Essays", essay: "Essays", recommendations: "Recommendations",
  interview: "Interview", extracurricular_activities: "Extracurriculars",
  talent_ability: "Talent & Ability", character_personal_qualities: "Character",
  first_generation: "First-Gen Status", alumni_relation: "Legacy / Alumni",
  geographical_residence: "Geography", state_residency: "State Residency",
  racial_ethnic_status: "Race / Ethnicity", volunteer_work: "Volunteer Work",
  work_experience: "Work Experience", demonstrated_interest: "Demonstrated Interest",
  level_of_applicant_interest: "Demonstrated Interest",
};

function renderStatsTable(student: Record<string, unknown> | null, college: Record<string, unknown> | null): string {
  if (!student || !college) return "";
  const ts  = (student.test_scores  as Record<string, Record<string, number>>) || {};
  const sel = (college.selectivity  as Record<string, number>) || {};
  const cp  = (college.class_profile as Record<string, number>) || {};
  const ac  = (student.academic     as Record<string, number | string>) || {};
  const hs  = (student.high_school  as Record<string, unknown>) || {};
  const rows: string[] = [];

  const gpa = ac.gpa_unweighted as number | undefined;
  if (gpa) {
    const pct4 = cp.gpa_4_0_plus;
    const range = pct4 != null ? `${Math.round(pct4 * 100)}% admitted had 4.0+` : "—";
    let badge = "";
    if (pct4 != null) {
      if (gpa >= 4.0)   badge = `<span class="stats-badge sb-great">Top tier</span>`;
      else if (gpa >= 3.75) badge = `<span class="stats-badge sb-warn">Below most</span>`;
      else              badge = `<span class="stats-badge sb-danger">Well below</span>`;
    }
    const tierLabels = ["", "Very Low", "Low", "Average", "High", "Very High"];
    const tierLabel = tierLabels[(hs.rigor_tier as number) || 0] || "";
    const adjustCls  = hs.gpa_adjustment === "read_up" ? "sa-up" : "sa-neutral";
    const adjustNote = hs.gpa_adjustment === "read_up"
      ? "↑ Committee reads this GPA higher given school context"
      : "Read at face value for this school type";
    const schoolCtx = `<div class="school-context-row">
      ${hs.name ? `<span class="school-chip">${hs.name}</span>` : ""}
      ${tierLabel ? `<span class="school-chip">Rigor: ${tierLabel}</span>` : ""}
      ${hs.ap_courses_offered ? `<span class="school-chip">${hs.ap_courses_offered} APs offered</span>` : ""}
    </div>
    <div class="school-context-row" style="margin-top:3px">
      <span class="school-adjust ${adjustCls}">${adjustNote}</span>
    </div>`;
    rows.push(`<div class="stats-row">
      <div class="stats-label">GPA</div>
      <div class="stats-value">${gpa.toFixed(2)}</div>
      <div class="stats-range">${range}</div>
      <div>${badge}</div>
    </div><div style="padding:0 0 10px">${schoolCtx}</div>`);
  }

  if (ts.sat) {
    const s25 = sel.sat_math_25, s75 = sel.sat_math_75;
    const val = ts.sat.total, mathVal = ts.sat.math;
    const rangeStr = s25 && s75 ? `Math range: ${s25}–${s75}` : "School range N/A";
    let badge = "";
    if (s25 && s75 && mathVal) {
      const mid = (s25 + s75) / 2;
      if (mathVal >= s75)    badge = `<span class="stats-badge sb-great">Math above 75th</span>`;
      else if (mathVal >= mid) badge = `<span class="stats-badge sb-good">Math above median</span>`;
      else if (mathVal >= s25) badge = `<span class="stats-badge sb-warn">Math below median</span>`;
      else                   badge = `<span class="stats-badge sb-danger">Math below 25th</span>`;
    }
    rows.push(`<div class="stats-row"><div class="stats-label">SAT</div><div class="stats-value">${val}</div><div class="stats-range">${rangeStr}</div><div>${badge}</div></div>`);
  }
  if (ts.act) {
    const a25 = sel.act_25, a75 = sel.act_75, val = ts.act.composite;
    const range = a25 && a75 ? `${a25} – ${a75}` : "Range N/A";
    let badge = "";
    if (a25 && a75) {
      const mid = (a25 + a75) / 2;
      if (val >= a75)    badge = `<span class="stats-badge sb-great">Above 75th</span>`;
      else if (val >= mid) badge = `<span class="stats-badge sb-good">Above median</span>`;
      else if (val >= a25) badge = `<span class="stats-badge sb-warn">Below median</span>`;
      else               badge = `<span class="stats-badge sb-danger">Below 25th</span>`;
    }
    rows.push(`<div class="stats-row"><div class="stats-label">ACT</div><div class="stats-value">${val}</div><div class="stats-range">${range}</div><div>${badge}</div></div>`);
  }
  if (!rows.length) return "";
  return `<div><div class="card-section-title neutral">Stats at a Glance</div><div class="stats-table">${rows.join("")}</div></div>`;
}

function renderFinancialAid(fa: Record<string, unknown>): string {
  if (!fa) return "";
  const items = [
    { label: "Need Blind",       val: fa.need_blind,          isBool: true },
    { label: "Meets Full Need",  val: fa.meets_full_need,     isBool: true },
    { label: "No-Loan Policy",   val: fa.no_loan_policy,      isBool: true },
    { label: "Merit Aid",        val: fa.merit_aid_available, isBool: true },
    { label: "Avg Need-Based Aid", val: fa.avg_need_based_aid ? `$${(fa.avg_need_based_aid as number).toLocaleString()}` : null, isBool: false },
  ].filter((i) => i.val !== undefined && i.val !== null);
  const gridHTML = items.map((i) => {
    const display = i.isBool ? (i.val ? "Yes" : "No") : i.val;
    const cls = i.isBool ? (i.val ? "fa-yes" : "fa-no") : "";
    return `<div class="fa-item"><div class="fa-label">${i.label}</div><div class="fa-value ${cls}">${display}</div></div>`;
  }).join("");
  return `<details class="fin-aid-details">
    <summary>Financial Aid Profile</summary>
    <div class="fin-aid-body">${gridHTML}</div>
    ${fa.notes ? `<div class="fin-aid-notes">${fa.notes}</div>` : ""}
  </details>`;
}

function renderHowWeEvaluate(college: Record<string, unknown>): string {
  const af  = (college.admission_factors as Record<string, string>) || {};
  const pol = (college.policies          as Record<string, unknown>) || {};
  const req = (college.requirements      as Record<string, unknown>) || {};
  const cp  = (college.class_profile     as Record<string, number>)  || {};
  const sc  = (college.special_considerations as string[]) || [];

  const groups: Record<string, string[]> = { "Very Important": [], "Important": [], "Considered": [], "Not Considered": [] };
  Object.entries(af).forEach(([k, v]) => {
    if (k === "source") return;
    const label = FACTOR_LABELS[k] || k;
    if (groups[v]) groups[v].push(label);
  });

  const tierCfg = [
    { key: "Very Important", cls: "fpill-vi", color: "#1B6B51" },
    { key: "Important",      cls: "fpill-i",  color: "#006B5F" },
    { key: "Considered",     cls: "fpill-c",  color: "var(--sim-outline)" },
  ];
  const pillsHTML = tierCfg.filter((t) => groups[t.key].length > 0).map((t) => `
    <div class="factor-tier-group">
      <div class="factor-tier-label" style="color:${t.color}">${t.key}</div>
      <div class="factor-pill-row">${groups[t.key].map((f) => `<span class="fpill ${t.cls}">${f}</span>`).join("")}</div>
    </div>`).join("");

  const nc = groups["Not Considered"];
  const notConsideredHTML = nc.length ? `<div class="not-considered-row">
    <span class="not-considered-label">Does not consider:</span>
    ${nc.map((f) => `<span class="fpill fpill-nc">${f}</span>`).join("")}
  </div>` : "";

  const signals: { i: string; t: string }[] = [];
  const demoInterest = af.demonstrated_interest || af.level_of_applicant_interest;
  if (["Very Important", "Important"].includes(demoInterest))
    signals.push({ i: "⚡", t: "Demonstrated interest is tracked — campus visits and direct contact matter" });
  if (["Very Important", "Important"].includes(af.alumni_relation))
    signals.push({ i: "🎖", t: "Legacy applicants receive meaningful advantage in committee review" });
  if (["Very Important", "Important"].includes(af.first_generation))
    signals.push({ i: "🌱", t: "First-generation college students receive significant additional consideration" });
  if (["Required", "Recommended"].includes(req.interview as string))
    signals.push({ i: "🗣", t: `Interview ${(req.interview as string || "").toLowerCase()} — carries real weight` });
  if (pol.test_optional === false && af.test_scores === "Very Important")
    signals.push({ i: "📝", t: "Test scores are required — no test-optional path at this institution" });
  const signalsHTML = signals.length ? `<div class="signals-group">${signals.slice(0, 3).map((s) =>
    `<div class="signal-item"><span class="signal-icon">${s.i}</span><span>${s.t}</span></div>`).join("")}</div>` : "";

  const cpRows: { v: string; l: string }[] = [];
  if (cp.hs_rank_top_10_pct) cpRows.push({ v: `${Math.round(cp.hs_rank_top_10_pct * 100)}%`, l: "Top 10%\nof HS class" });
  if (cp.gpa_4_0_plus)       cpRows.push({ v: `${Math.round(cp.gpa_4_0_plus * 100)}%`,       l: "GPA\n4.0+" });
  if (cp.gpa_3_75_to_3_99)   cpRows.push({ v: `${Math.round(cp.gpa_3_75_to_3_99 * 100)}%`,   l: "GPA\n3.75–3.99" });
  const classProfileHTML = cpRows.length ? `<div>
    <div class="subsection-label">Last Admitted Class</div>
    <div class="class-profile-grid">${cpRows.map((r) => `<div class="cp-stat"><div class="cp-value">${r.v}</div><div class="cp-label">${r.l}</div></div>`).join("")}</div>
  </div>` : "";

  const reqRows: { i: string; l: string }[] = [];
  if (req.essays_required != null)    reqRows.push({ i: req.essays_required ? "✓" : "○", l: req.essays_required ? "Essays required" : "No essay required" });
  if (req.recommendations_required)   reqRows.push({ i: "✓", l: `${req.recommendations_required} recommendations` });
  if (req.interview)                  reqRows.push({ i: "💬", l: `Interview: ${req.interview}` });
  if (pol.common_app != null)         reqRows.push({ i: pol.common_app ? "✓" : "✗", l: pol.common_app ? "Common App accepted" : "Own application only" });
  const reqHTML = reqRows.length ? `<div>
    <div class="subsection-label">Requirements</div>
    <div class="req-grid">${reqRows.map((r) => `<div class="req-item"><span class="req-icon">${r.i}</span><span>${r.l}</span></div>`).join("")}</div>
  </div>` : "";

  const ethosHTML = sc.length ? `<div class="ethos-quote">✦ "${sc[0]}"</div>` : "";

  return `<div class="how-evaluate-section">${pillsHTML}${notConsideredHTML}${signalsHTML}${classProfileHTML}${reqHTML}${ethosHTML}</div>`;
}

function renderBullets(items: unknown[], type: "strength" | "concern" | "improve"): string {
  if (!items?.length) return "";
  const cfg = {
    strength: { title: "✓  Strengths", cls: "strengths", icon: "+", icls: "bi-strength" },
    concern:  { title: "✕  Concerns",  cls: "concerns",  icon: "−", icls: "bi-concern" },
    improve:  { title: "→  What to Improve", cls: "improve", icon: "→", icls: "bi-improve" },
  }[type];
  const html = items.map((item) => {
    const headline = typeof item === "string" ? item : ((item as Record<string,string>).headline || (item as Record<string,string>).action || "");
    const detail   = typeof item === "object" ? ((item as Record<string,string>).detail || "") : "";
    const id = `b-${Math.random().toString(36).slice(2, 9)}`;
    return `<div class="bullet-item" id="${id}">
      <div class="bullet-headline-row" ${detail ? `onclick="document.getElementById('${id}').classList.toggle('open')"` : ""} style="cursor:${detail ? "pointer" : "default"}">
        <span class="bullet-icon ${cfg.icls}">${cfg.icon}</span>
        <span class="bullet-headline">${headline}</span>
        ${detail ? `<span class="bullet-expand">▾</span>` : ""}
      </div>
      ${detail ? `<div class="bullet-detail">${detail}</div>` : ""}
    </div>`;
  }).join("");
  return `<div><div class="card-section-title ${cfg.cls}">${cfg.title}</div>${html}</div>`;
}

function renderCommitteeNote(note: string): string {
  if (!note) return "";
  const id = `cn-${Math.random().toString(36).slice(2, 9)}`;
  return `<div>
    <button class="committee-toggle" onclick="
      document.getElementById('${id}').classList.toggle('open');
      const ch=document.getElementById('${id}-ch');
      if(ch) ch.textContent=document.getElementById('${id}').classList.contains('open')?'▴':'▾';
    ">
      Read full committee note <span id="${id}-ch" class="committee-chevron">▾</span>
    </button>
    <div class="committee-note-body" id="${id}">${note}</div>
  </div>`;
}

function renderCard(r: Record<string, unknown>, college: Record<string, unknown> | null, student: Record<string, unknown> | null = null): string {
  if (r.error) return `<div class="college-card"><div class="verdict-strip" style="border-left-color:var(--sim-error)"><div class="verdict-main"><div class="verdict-college-name" style="color:var(--sim-error)">${r.college}</div><div style="font-size:13px;color:var(--sim-error);padding:8px 0">⚠ ${r.error}</div></div></div></div>`;

  const score = (r.score as number) || 0;
  const tc = tierColors(score);
  const bd = (r.score_breakdown as Record<string, number>) || {};
  const rate = (college as Record<string, Record<string, number>>)?.selectivity?.acceptance_rate;
  const rateStr = rate ? `${(rate * 100).toFixed(1)}% acceptance rate` : "Open admissions";

  const miniCats: [string, string][] = [
    ["Academic", "academic_fit"], ["Tests", "test_scores"],
    ["Activities", "extracurriculars"], ["Essays", "essays_and_personal"], ["Holistic", "holistic_factors"],
  ];
  const breakdownMini = miniCats.map(([lbl, key]) => {
    const v = bd[key] || 0;
    return `<div class="vb-row"><div class="vb-label">${lbl}</div><div class="vb-track"><div class="vb-fill" data-w="${v}" style="width:0%;background:${barColor(v)}"></div></div><div class="vb-val">${v}</div></div>`;
  }).join("");

  const conf = r.confidence != null ? (r.confidence as number) : null;
  const confNote = (r.confidence_note as string) || "";
  let confCls = "cf-conf-vlow";
  if (conf != null) {
    if (conf >= 70) confCls = "cf-conf-high";
    else if (conf >= 45) confCls = "cf-conf-mid";
    else if (conf >= 25) confCls = "cf-conf-low";
  }
  const confId = `conf-${Math.random().toString(36).slice(2, 8)}`;
  const confHTML = conf != null ? `<div class="confidence-section">
    <div class="confidence-row">
      <div class="confidence-label-col">Confidence</div>
      <div class="confidence-track"><div class="confidence-fill ${confCls}" data-w="${conf}" style="width:0%"></div></div>
      <div class="confidence-pct" style="color:${tc.border}">${conf}%</div>
      ${confNote ? `<button class="reveal-btn" onclick="const el=document.getElementById('${confId}');el.classList.toggle('open');this.classList.toggle('open')">▾</button>` : ""}
    </div>
    ${confNote ? `<div class="reveal-content" id="${confId}">${confNote}</div>` : ""}
  </div>` : "";

  const nc = r.narrative_coherence as Record<string, unknown> | undefined;
  const narrative = (r.application_narrative as string) || "";
  const decision = (r.committee_decision as string) || "";
  const labelCls: Record<string, string> = { Strong: "nc-strong", Clear: "nc-clear", Mixed: "nc-mixed", Scattered: "nc-scattered" };
  const ncId = `nc-${Math.random().toString(36).slice(2, 8)}`;
  const narrativeBanner = (narrative || nc) ? `<div class="narrative-banner">
    <div class="narrative-eyebrow">Student Narrative</div>
    <div class="narrative-text">${narrative || "—"}</div>
    ${decision ? `<div class="narrative-decision">${decision}</div>` : ""}
    ${nc ? `<div class="narrative-meta">
      <span class="narrative-score-pill ${labelCls[(nc.label as string)] || ""}">${nc.label} narrative · ${nc.score}/100</span>
      ${nc.note ? `<button class="reveal-btn" onclick="const el=document.getElementById('${ncId}');el.classList.toggle('open');this.classList.toggle('open')">▾</button>` : ""}
    </div>
    ${nc.note ? `<div class="reveal-content" id="${ncId}">${nc.note}</div>` : ""}` : ""}
  </div>` : "";

  return `<div class="college-card">
    <div class="verdict-strip" style="border-left-color:${tc.border};background:${tc.lightBg}">
      <div class="verdict-main">
        <div class="verdict-college-name" style="color:${tc.border}">${r.college}</div>
        <div class="verdict-rate">${rateStr}</div>
        ${confHTML}
      </div>
      <div class="verdict-score-block">
        <div class="verdict-score-top">
          <div class="verdict-score-number" style="color:${tc.border}">${score}</div>
          <span class="verdict-tier-pill" style="background:${tc.bg};color:${tc.text}">${r.tier || "N/A"}</span>
        </div>
        <div class="verdict-score-denom">/100</div>
        <div class="score-main-bar-wrap"><div class="score-main-bar-fill" data-w="${score}" style="width:0%;background:${tc.bar}"></div></div>
        <div class="verdict-breakdown">${breakdownMini}</div>
      </div>
    </div>
    <div class="card-body">
      ${narrativeBanner}
      ${renderStatsTable(student, college)}
      ${renderBullets((r.strengths as unknown[]) || [], "strength")}
      ${renderBullets((r.concerns  as unknown[]) || [], "concern")}
      ${renderBullets((r.what_to_improve as unknown[]) || [], "improve")}
      ${renderCommitteeNote((r.committee_note as string) || "")}
      ${college ? renderFinancialAid((college.financial_aid as Record<string, unknown>) || {}) : ""}
      ${r.profile_completeness && r.profile_completeness !== "complete"
        ? `<div class="completeness-banner">⚠ Profile status: ${(r.profile_completeness as string).toUpperCase()} — some scores are projections</div>` : ""}
    </div>
    ${college ? `<div class="how-evaluates-divider"></div>
    <div class="how-evaluates-outer">
      <div class="how-evaluates-title">How ${collegeShortName(college)} Evaluates</div>
      ${renderHowWeEvaluate(college)}
    </div>` : ""}
  </div>`;
}

function calcCompleteness(student: Record<string, unknown>): number {
  let score = 0;
  const yearMap: Record<string, number> = { senior: 4, junior: 3, sophomore: 2, freshman: 1 };
  score += Math.round(((yearMap[(student.year as string)] || 1) / 4) * 25);
  const ts = (student.test_scores as Record<string, unknown>) || {};
  if ((ts.sat as Record<string, number>)?.total || (ts.act as Record<string, number>)?.composite) score += 20;
  else if ((ts.psat as Record<string, number>)?.total) score += 7;
  const acts = ((student.activities as unknown[]) || []).length;
  score += Math.min(15, Math.round(acts * 1.5));
  const eq = (student as Record<string, Record<string, string>>).essays?.main_essay_quality || "not_yet_written";
  if (!["not_yet_written", "not_started"].includes(eq)) score += 20;
  if (student.high_school) score += 5;
  if (student.year === "senior") score += 5;
  return Math.min(97, score);
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  colleges: Record<string, unknown>[];
  students: Record<string, unknown>[];
  seniors:  Record<string, unknown>[];
}

export default function SimulatorClient({ colleges, students, seniors }: Props) {
  const { profile } = useHalda();
  const reportBodyRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<View>("select");
  const [selectedSlug, setSelectedSlug]     = useState<string | null>(null);
  const [selectedColleges, setSelectedColleges] = useState<CollegeMeta[]>([]);
  const [loadingState, setLoadingState]     = useState<Record<string, LoadState>>({});
  const [results, setResults]               = useState<Record<string, unknown>[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Record<string, unknown> | null>(null);
  const [seniorFill, setSeniorFill]         = useState(false);
  const [useSample, setUseSample]           = useState(false);

  const [collegeSearch, setCollegeSearch]       = useState("");
  const [additionalColleges, setAdditionalColleges] = useState<Record<string, unknown>[]>([]);
  const [buildingUniversity, setBuildingUniversity] = useState(false);
  const [buildStatus, setBuildStatus]           = useState("");

  const haldaStudent = profile.id
    ? translateHaldaProfile(profile, seniors, seniorFill)
    : null;

  // Auto-select Halda student on first load
  useEffect(() => {
    if (haldaStudent && !selectedSlug) {
      setSelectedSlug("halda_student");
      setCurrentStudent(haldaStudent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // Recompute translated student when seniorFill changes
  useEffect(() => {
    if (selectedSlug === "halda_student" && haldaStudent) {
      setCurrentStudent(translateHaldaProfile(profile, seniors, seniorFill));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seniorFill]);

  // Animate bars after report renders
  useEffect(() => {
    if (view === "report") {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        reportBodyRef.current?.querySelectorAll<HTMLElement>("[data-w]").forEach((el) => {
          el.style.width = Math.min(100, parseFloat(el.dataset.w!)) + "%";
        });
      }));
    }
  }, [view, results]);

  function selectStudent(slug: string) {
    setSelectedSlug(slug);
    if (slug === "halda_student") {
      setCurrentStudent(translateHaldaProfile(profile, seniors, seniorFill));
    } else {
      setCurrentStudent(students.find((s) => s.slug === slug) ?? null);
    }
  }

  function toggleCollege(slug: string, name: string) {
    setSelectedColleges((prev) => {
      if (prev.find((c) => c.slug === slug)) return prev.filter((c) => c.slug !== slug);
      if (prev.length >= 5) return prev;
      return [...prev, { slug, name }];
    });
  }

  const startEvaluation = useCallback(async () => {
    if (!selectedSlug || !currentStudent || selectedColleges.length === 0) return;

    const init: Record<string, LoadState> = {};
    selectedColleges.forEach((c) => { init[c.slug] = "running"; });
    setLoadingState(init);
    setResults([]);
    setView("loading");

    const payload: Record<string, unknown> = {
      student_slug: selectedSlug,
      college_slugs: selectedColleges.map((c) => c.slug),
    };
    if (selectedSlug === "halda_student") payload.halda_profile = currentStudent;

    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const reader  = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const collected: Record<string, unknown>[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const chunk = line.slice(6).trim();
        if (chunk === "__done__") { setResults([...collected]); setView("report"); return; }
        try {
          const r = JSON.parse(chunk) as Record<string, unknown>;
          collected.push(r);
          setLoadingState((prev) => ({ ...prev, [r._slug as string]: "done" }));
        } catch { /* ignore */ }
      }
    }
  }, [selectedSlug, currentStudent, selectedColleges]);

  const allColleges = [...colleges, ...additionalColleges];
  const collegeBySlug = Object.fromEntries(allColleges.map((c) => [c.slug, c]));
  const canRun = !!selectedSlug && selectedColleges.length > 0;

  const filteredColleges = collegeSearch.trim()
    ? allColleges.filter((c) => (c.name as string).toLowerCase().includes(collegeSearch.trim().toLowerCase()))
    : allColleges;
  const showBuildBtn = collegeSearch.trim().length > 0 && filteredColleges.length === 0;

  async function buildUniversity(name: string) {
    setBuildingUniversity(true);
    setBuildStatus(`Fetching data for "${name}"…`);
    const timer = setTimeout(() => setBuildStatus("Building acceptance committee with Claude AI…"), 2500);
    try {
      const resp = await fetch("/api/build_university", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error || "Build failed");
      }
      const profile = await resp.json() as Record<string, unknown>;
      setAdditionalColleges((prev) => [...prev, profile]);
      setCollegeSearch("");
      toggleCollege(profile.slug as string, profile.name as string);
    } catch (e) {
      clearTimeout(timer);
      alert(`Could not build university profile: ${(e as Error).message}`);
    } finally {
      setBuildingUniversity(false);
    }
  }

  // ── Views ────────────────────────────────────────────────────────────────

  const displayStudents = useSample
    ? students
    : haldaStudent
    ? [haldaStudent]
    : students;

  return (
    <div className="sim-app">

      {/* ── Demo toolbar ── */}
      {haldaStudent && (
        <div className="sim-toolbar">
          <span className="sim-toolbar-badge">⚙ Demo Mode</span>
          <span className="sim-toolbar-name">{haldaStudent.name as string}</span>
          <span className="sim-toolbar-meta">
            from Halda
            {(haldaStudent._fill_source as string) && ` · academics filled from ${haldaStudent._fill_source as string}`}
          </span>
          <div className="sim-toolbar-divider" />
          <div className="sim-toolbar-checks">
            <label>
              <input
                type="checkbox"
                checked={seniorFill}
                onChange={(e) => setSeniorFill(e.target.checked)}
              />
              Fill missing academic data with sample senior
            </label>
            <label>
              <input
                type="checkbox"
                checked={useSample}
                onChange={(e) => {
                  setUseSample(e.target.checked);
                  if (!e.target.checked && haldaStudent) selectStudent("halda_student");
                  else if (e.target.checked && selectedSlug === "halda_student") {
                    setSelectedSlug(null);
                    setCurrentStudent(null);
                  }
                }}
              />
              Use a different sample student instead
            </label>
          </div>
        </div>
      )}

      {/* ── Selection view ── */}
      {view === "select" && (
        <div className="sim-shell">
          <div className="sim-topbar">
            <div className="sim-eyebrow">HALDA AI</div>
            <div className="sim-title">Admissions Simulator</div>
            <div className="sim-sub">Select a student and colleges to evaluate</div>
          </div>

          <div className="sim-scroll">
            <div className="sim-section-label">Student</div>
            <div className="sim-student-list">
              {displayStudents.map((s) => {
                const slug = s.slug as string;
                const isHalda = slug === "halda_student";
                const pct = calcCompleteness(s);
                const fillCls = pct >= 80 ? "cf-high" : pct >= 50 ? "cf-mid" : "cf-low";
                const selected = selectedSlug === slug;
                return (
                  <div
                    key={slug}
                    className={`sim-student-card${selected ? " selected" : ""}${isHalda ? " halda-card" : ""}`}
                    onClick={() => selectStudent(slug)}
                  >
                    <div className="sim-student-row1">
                      <div>
                        <div className="sim-student-name">{s.name as string}</div>
                        <div className="sim-student-arch">{s.archetype as string}</div>
                        {isHalda && <span className="sim-halda-badge">From Halda</span>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <span className={`sim-year-pill year-${s.year as string}`}>{s.year as string}</span>
                        <div className={`sim-check-ring${selected ? " selected" : ""}`}>
                          {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                    </div>
                    <div className="sim-stats">
                      {(s as Record<string, Record<string, number>>).academic?.gpa_unweighted && (
                        <span className="sim-stat-chip">GPA {(s as Record<string, Record<string, number>>).academic.gpa_unweighted}</span>
                      )}
                      {(s as Record<string, Record<string, Record<string, number>>>).test_scores?.sat?.total && (
                        <span className="sim-stat-chip">SAT {(s as Record<string, Record<string, Record<string, number>>>).test_scores.sat.total}</span>
                      )}
                      {(s as Record<string, Record<string, string>>).demographics?.state && (
                        <span className="sim-stat-chip">{(s as Record<string, Record<string, string>>).demographics.state}</span>
                      )}
                      {(s as Record<string, Record<string, boolean>>).demographics?.first_gen && (
                        <span className="sim-stat-chip sim-stat-firstgen">First-gen</span>
                      )}
                    </div>
                    <div className="sim-completeness-row">
                      <span className="sim-completeness-label">Scholastic Progress</span>
                      <div className="sim-completeness-track">
                        <div className={`sim-completeness-fill ${fillCls}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="sim-completeness-pct">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sim-section-label">
              Colleges <span>{selectedColleges.length} / 5 selected</span>
            </div>

            {/* Search */}
            <div className="sim-college-search-wrap">
              <input
                type="text"
                className="sim-college-search"
                placeholder="Search universities…"
                value={collegeSearch}
                onChange={(e) => setCollegeSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="sim-college-list">
              {filteredColleges.map((c) => {
                const slug = c.slug as string;
                const chosen = selectedColleges.some((x) => x.slug === slug);
                const disabled = !chosen && selectedColleges.length >= 5;
                const rate = (c as Record<string, Record<string, number>>).selectivity?.acceptance_rate;
                const isNew = additionalColleges.some((a) => a.slug === slug);
                return (
                  <div
                    key={slug}
                    className={`sim-college-row${chosen ? " selected" : ""}${disabled ? " disabled" : ""}`}
                    onClick={() => !disabled && toggleCollege(slug, c.name as string)}
                  >
                    <div className={`sim-checkbox${chosen ? " selected" : ""}`}>
                      {chosen && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="sim-college-info">
                      <div className="sim-college-name">
                        {c.name as string}
                        {isNew && <span className="sim-ai-badge">AI-BUILT</span>}
                      </div>
                      <div className="sim-college-rate">
                        {rate ? `${(rate * 100).toFixed(1)}% acceptance rate` : "Open admissions"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Not found: show build button */}
            {showBuildBtn && !buildingUniversity && (
              <div className="sim-not-found">
                <div className="sim-not-found-text">University not in our database</div>
                <button className="sim-build-btn" onClick={() => buildUniversity(collegeSearch.trim())}>
                  ⚡ Build &ldquo;{collegeSearch.trim()}&rdquo; Acceptance Committee
                </button>
              </div>
            )}

            {/* Building state */}
            {buildingUniversity && (
              <div className="sim-building-state">
                <div className="sim-building-spinner" />
                <div className="sim-building-status">Building University Committee…</div>
              </div>
            )}
          </div>

          <div className="sim-run-footer">
            <button className="sim-run-btn" disabled={!canRun} onClick={startEvaluation}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2.5L13 8L3 13.5V2.5Z" fill="currentColor"/></svg>
              Run Evaluation
            </button>
          </div>
        </div>
      )}

      {/* ── Loading view ── */}
      {view === "loading" && (
        <div className="sim-shell">
          <div className="sim-loading-topbar">
            <div className="sim-eyebrow">HALDA AI</div>
            <div className="sim-loading-title">{currentStudent?.name as string}</div>
            <div className="sim-loading-sub">
              Consulting {selectedColleges.length} simulated agentic committee{selectedColleges.length > 1 ? "s" : ""}
            </div>
          </div>
          <div className="sim-loading-body">
            {selectedColleges.map((c) => {
              const state = loadingState[c.slug] || "running";
              return (
                <div key={c.slug} className="sim-loading-item">
                  <div className={`sim-loading-icon ${state}`}>
                    {state === "running" && <div className="spin" />}
                    {state === "done" && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="#1B6B51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="sim-loading-name">{c.name}</span>
                  <span className={`sim-loading-status ${state}`}>
                    {state === "running" ? "Evaluating…" : "Done"}
                  </span>
                </div>
              );
            })}
            <div className="sim-how-it-works">
              Each college runs as a separate AI committee, evaluated against that school&apos;s own published factor weights, selectivity data, and class benchmarks.
            </div>
          </div>
        </div>
      )}

      {/* ── Report view ── */}
      {view === "report" && (
        <div className="sim-shell">
          <div className="sim-report-topbar">
            <button className="sim-back-btn" onClick={() => setView("select")}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              New evaluation
            </button>
            <div className="sim-report-name">{currentStudent?.name as string}</div>
            <div className="sim-report-sub">{currentStudent?.archetype as string} · {cap(currentStudent?.year as string)}</div>
          </div>
          <div className="sim-report-body" ref={reportBodyRef}>
            <div
              dangerouslySetInnerHTML={{
                __html:
                  [...results]
                    .sort((a, b) => ((b.score as number) || 0) - ((a.score as number) || 0))
                    .map((r) => renderCard(r, collegeBySlug[(r._slug as string)] ?? null, currentStudent))
                    .join("") +
                  `<div class="sim-disclaimer"><strong>Disclaimer:</strong> AI simulation based on publicly available data. Not affiliated with any university. Not a prediction of actual admissions outcomes.</div>`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
