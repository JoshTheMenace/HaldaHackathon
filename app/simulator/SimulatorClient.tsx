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

function renderCard(r: Record<string, unknown>, college: Record<string, unknown> | null): string {
  if (r.error) return `<div class="college-card"><div class="verdict-strip" style="border-left-color:var(--sim-error)"><div class="verdict-main"><div class="verdict-college-name" style="color:var(--sim-error)">${r.college}</div><div style="font-size:13px;color:var(--sim-error);padding:8px 0">⚠ ${r.error}</div></div></div></div>`;

  const score = (r.score as number) || 0;
  const tc = tierColors(score);
  const bd = (r.score_breakdown as Record<string, number>) || {};
  const rate = (college as Record<string, Record<string, number>>)?.selectivity?.acceptance_rate;
  const rateStr = rate ? `${(rate * 100).toFixed(1)}% acceptance rate` : "Acceptance rate not reported";

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
      ${renderBullets((r.strengths as unknown[]) || [], "strength")}
      ${renderBullets((r.concerns  as unknown[]) || [], "concern")}
      ${renderBullets((r.what_to_improve as unknown[]) || [], "improve")}
      ${renderCommitteeNote((r.committee_note as string) || "")}
      ${r.profile_completeness && r.profile_completeness !== "complete"
        ? `<div class="completeness-banner">⚠ Profile status: ${(r.profile_completeness as string).toUpperCase()} — some scores are projections</div>` : ""}
    </div>
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

  const collegeBySlug = Object.fromEntries(colleges.map((c) => [c.slug, c]));
  const canRun = !!selectedSlug && selectedColleges.length > 0;

  // ── Views ────────────────────────────────────────────────────────────────

  const displayStudents = useSample
    ? students
    : haldaStudent
    ? [haldaStudent, ...students]
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
            <div className="sim-college-list">
              {colleges.map((c) => {
                const slug = c.slug as string;
                const chosen = selectedColleges.some((x) => x.slug === slug);
                const disabled = !chosen && selectedColleges.length >= 5;
                const rate = (c as Record<string, Record<string, number>>).selectivity?.acceptance_rate;
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
                      <div className="sim-college-name">{c.name as string}</div>
                      <div className="sim-college-rate">
                        {rate ? `${(rate * 100).toFixed(1)}% acceptance rate` : "Acceptance rate not reported"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                    .map((r) => renderCard(r, collegeBySlug[(r._slug as string)] ?? null))
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
